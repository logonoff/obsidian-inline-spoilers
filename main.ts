import { syntaxTree } from '@codemirror/language';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
} from '@codemirror/view';
import { App, Editor, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting, Workspace } from 'obsidian';

/** Regex to match ||spoiler|| syntax */
const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

/**
 * Given raw markdown source text, finds all `||` delimiter occurrences and
 * returns a Set of their ordinal positions (0-indexed) where at least one
 * pipe in the `||` is backslash-escaped in the source.
 *
 * For example, in `\|\|case 9.1\|\| ||real spoiler||`:
 *   - The 1st `||` (ordinal 0) has escaped pipes → included in the set
 *   - The 2nd `||` (ordinal 1) has escaped pipes → included in the set
 *   - The 3rd `||` (ordinal 2) is unescaped → NOT in the set
 *   - The 4th `||` (ordinal 3) is unescaped → NOT in the set
 */
const findEscapedDelimiters = (rawMarkdown: string): Set<number> => {
	const escaped = new Set<number>();

	// Find all `||` in the raw markdown (after resolving escapes).
	// Walk char by char, tracking escape state, and count `||` pairs.
	let ordinal = 0;
	let i = 0;
	while (i < rawMarkdown.length - 1) {
		// Check for a `||` at this position (where each pipe may or may not be escaped)
		const firstIsEscapedPipe = rawMarkdown[i] === '\\' && rawMarkdown[i + 1] === '|';
		const firstIsPipe = rawMarkdown[i] === '|';

		if (!firstIsEscapedPipe && !firstIsPipe) {
			// Skip escape sequences that aren't pipes
			if (rawMarkdown[i] === '\\' && i + 1 < rawMarkdown.length) {
				i += 2;
			} else {
				i++;
			}
			continue;
		}

		// We found a pipe (escaped or literal) at position i.
		// Now look for the second pipe immediately after.
		const firstLen = firstIsEscapedPipe ? 2 : 1;
		const nextPos = i + firstLen;

		if (nextPos >= rawMarkdown.length) {
			i += firstLen;
			continue;
		}

		const secondIsEscapedPipe = rawMarkdown[nextPos] === '\\' && nextPos + 1 < rawMarkdown.length && rawMarkdown[nextPos + 1] === '|';
		const secondIsPipe = rawMarkdown[nextPos] === '|';

		if (!secondIsEscapedPipe && !secondIsPipe) {
			// Single pipe, not a delimiter
			i += firstLen;
			continue;
		}

		// We found a `||` delimiter (with some combination of escaped/literal pipes)
		const secondLen = secondIsEscapedPipe ? 2 : 1;

		if (firstIsEscapedPipe || secondIsEscapedPipe) {
			escaped.add(ordinal);
		}

		ordinal++;
		i += firstLen + secondLen;
	}

	return escaped;
}

/** Allowed HTML tags to process for spoilers */
const TAGS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, em, strong, b, i, a, th, td"

/*
 * Reading mode
 */
/**
 * Finds which child node of `parent` contains the character at `offset`
 * within the parent's concatenated textContent, and returns the child node
 * along with the local offset within that child's textContent.
 */
const findChildAtOffset = (parent: Node, offset: number): { node: Node, localOffset: number } | null => {
	let cumulative = 0;
	for (const child of Array.from(parent.childNodes)) {
		const len = child.textContent?.length ?? 0;
		if (offset < cumulative + len) {
			return { node: child, localOffset: offset - cumulative };
		}
		cumulative += len;
	}
	return null;
}

/**
 * Finds all `||` delimiter positions in the given text and returns their
 * character indices along with whether each is escaped (by ordinal lookup).
 * Each spoiler `||content||` uses two delimiters: an opening and a closing.
 */
const findDelimiterPairs = (text: string, escapedDelimiters: Set<number>, delimiterCounter: { value: number }): { start: number, end: number }[] => {
	SPOILER_REGEX.lastIndex = 0;
	const matches: { start: number, end: number }[] = [];
	let match: RegExpExecArray | null;

	while ((match = SPOILER_REGEX.exec(text)) !== null) {
		const openOrdinal = delimiterCounter.value;
		const closeOrdinal = delimiterCounter.value + 1;
		delimiterCounter.value += 2;

		// Skip if either the opening or closing delimiter is escaped
		if (escapedDelimiters.has(openOrdinal) || escapedDelimiters.has(closeOrdinal)) {
			continue;
		}

		matches.push({ start: match.index, end: match.index + match[0].length });
	}

	return matches;
}

const processElement = (element: Node, escapedDelimiters: Set<number>, delimiterCounter: { value: number }) => {
	if (element.nodeType !== Node.ELEMENT_NODE) return;

	// Don't process nodes that are already spoiler spans
	if (element instanceof HTMLElement && element.classList.contains("inline_spoilers-spoiler")) return;

	const fullText = element.textContent ?? "";
	if (!fullText.includes("||")) return;

	// Save counter state so we can replay it for the actual processing
	const savedCounter = delimiterCounter.value;

	// Find all valid (non-escaped) spoiler matches
	const validMatches = findDelimiterPairs(fullText, escapedDelimiters, delimiterCounter);

	if (validMatches.length === 0) {
		// No spoilers at this level, recurse into child elements
		// Reset counter since findDelimiterPairs already advanced it
		for (const child of Array.from(element.childNodes)) {
			if (child.nodeType === Node.ELEMENT_NODE) {
				processElement(child, escapedDelimiters, delimiterCounter);
			}
		}
		return;
	}

	// Check if all matches fall within single text nodes (simple case)
	const allInTextNodes = validMatches.every(m => {
		const startInfo = findChildAtOffset(element, m.start);
		const endInfo = findChildAtOffset(element, m.end - 1);
		return startInfo && endInfo && startInfo.node === endInfo.node && startInfo.node.nodeType === Node.TEXT_NODE;
	});

	if (allInTextNodes) {
		// Simple case: all spoilers are within individual text nodes, process
		// each text node independently.
		// Reset the counter and let processTextNode / recursive processElement
		// re-count delimiters as they process each child.
		delimiterCounter.value = savedCounter;
		for (const child of Array.from(element.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				processTextNode(child, escapedDelimiters, delimiterCounter);
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				processElement(child, escapedDelimiters, delimiterCounter);
			}
		}
		return;
	}

	// Complex case: spoilers span across child nodes (e.g. text + link + text).
	// We need to wrap ranges of child nodes into spoiler spans.
	// Process matches in reverse so earlier indices remain valid.
	for (let i = validMatches.length - 1; i >= 0; i--) {
		const { start, end } = validMatches[i];

		const startInfo = findChildAtOffset(element, start);
		const endInfo = findChildAtOffset(element, end - 1);
		if (!startInfo || !endInfo) continue;

		const startNode = startInfo.node;
		const endNode = endInfo.node;

		// Split the starting text node if the || delimiter doesn't start at the beginning
		let firstWrappedNode = startNode;
		if (startNode.nodeType === Node.TEXT_NODE && startInfo.localOffset > 0) {
			(startNode as Text).splitText(startInfo.localOffset);
			firstWrappedNode = startNode.nextSibling!;
		}

		// Split the ending text node if the || delimiter doesn't end at the end
		let lastWrappedNode = endNode;
		if (endNode.nodeType === Node.TEXT_NODE) {
			const endLocalOffset = endInfo.localOffset + 1;
			const endText = endNode.textContent ?? "";
			if (endLocalOffset < endText.length) {
				(endNode as Text).splitText(endLocalOffset);
				lastWrappedNode = endNode;
			}
		}

		// Collect nodes to wrap
		const nodesToWrap: Node[] = [];
		let current: Node | null = firstWrappedNode;
		while (current) {
			nodesToWrap.push(current);
			if (current === lastWrappedNode) break;
			current = current.nextSibling;
		}

		if (nodesToWrap.length === 0) continue;

		// eslint-disable-next-line no-undef
		const spoilerSpan = createSpan({ cls: "inline_spoilers-spoiler" });

		// Insert the spoiler span before the first node to wrap
		element.insertBefore(spoilerSpan, nodesToWrap[0]);

		// Move nodes into the spoiler span, stripping the || delimiters
		for (const wrappedNode of nodesToWrap) {
			spoilerSpan.appendChild(wrappedNode);
		}

		// Remove the leading || from the first child
		const firstChild = spoilerSpan.firstChild;
		if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent) {
			firstChild.textContent = firstChild.textContent.replace(/^\|\|/, "");
		}

		// Remove the trailing || from the last child
		const lastChild = spoilerSpan.lastChild;
		if (lastChild && lastChild.nodeType === Node.TEXT_NODE && lastChild.textContent) {
			lastChild.textContent = lastChild.textContent.replace(/\|\|$/, "");
		}
	}

	// Recurse into any remaining non-spoiler child elements
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === Node.ELEMENT_NODE && !(child instanceof HTMLElement && child.classList.contains("inline_spoilers-spoiler"))) {
			processElement(child, escapedDelimiters, delimiterCounter);
		}
	}
}

/**
 * Processes a single text node, splitting it by ||spoiler|| patterns and
 * wrapping matched segments in spoiler spans.
 */
const processTextNode = (node: Node, escapedDelimiters: Set<number>, delimiterCounter: { value: number }) => {
	if (!node.textContent || !node.parentNode) return;

	const text = node.textContent;
	const validMatches = findDelimiterPairs(text, escapedDelimiters, delimiterCounter);

	if (validMatches.length === 0) return;

	const fragment = document.createDocumentFragment();
	let lastIndex = 0;

	for (const { start, end } of validMatches) {
		// Add any text before this match
		if (start > lastIndex) {
			fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
		}

		// Create the spoiler span (strip the || delimiters)
		const spoilerText = text.slice(start + 2, end - 2);
		// obsidian global helper
		// eslint-disable-next-line no-undef
		const spoilerSpan = createSpan({ cls: "inline_spoilers-spoiler", text: spoilerText });
		fragment.appendChild(spoilerSpan);

		lastIndex = end;
	}

	// Add any remaining text after the last match
	if (lastIndex < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
	}

	// Replace the original text node with the new fragment
	node.parentNode.replaceChild(fragment, node);
}

const updateReadingMode = (element: HTMLElement, plugin: InlineSpoilerPlugin, ctx?: MarkdownPostProcessorContext) => {
	// Compute which ordinal || delimiters are escaped in the raw markdown source.
	// getSectionInfo returns the full document text along with lineStart/lineEnd
	// for the section, so we extract just the relevant lines.
	let escapedDelimiters = new Set<number>();
	if (ctx) {
		const sectionInfo = ctx.getSectionInfo(element);
		if (sectionInfo) {
			const lines = sectionInfo.text.split("\n");
			const sectionText = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1).join("\n");
			escapedDelimiters = findEscapedDelimiters(sectionText);
		}
	}

	const allowedElems = element.findAll(TAGS);
	const delimiterCounter = { value: 0 };

	for (const elem of allowedElems) {
		// Process each child node of the element
		processElement(elem, escapedDelimiters, delimiterCounter);
	}

	const spoilers = element.findAll(".inline_spoilers-spoiler");

	for (const spoiler of spoilers) {
		plugin.registerDomEvent(spoiler, 'click', () => {
			spoiler.classList.toggle("inline_spoilers-revealed");
		});
	}
}

const unloadReadingMode = (workspace: Workspace) => {
	// remove all spoilers from reader mode
	const spoilers = Array.from(workspace.containerEl.querySelectorAll<HTMLElement>(".inline_spoilers-spoiler"));

	for (const spoiler of spoilers) {
		const parent = spoiler.parentNode;
		if (!parent) continue;

		// Re-wrap the spoiler content with || delimiters, preserving child nodes
		const fragment = document.createDocumentFragment();
		fragment.appendChild(document.createTextNode("||"));
		while (spoiler.firstChild) {
			fragment.appendChild(spoiler.firstChild);
		}
		fragment.appendChild(document.createTextNode("||"));
		parent.replaceChild(fragment, spoiler);
	}
}



/*
 * Editor mode
 */
/** The spoiler content between the `||` delimiters */
const spoilerDecoration = Decoration.mark({
	class: "inline_spoilers-editor-spoiler",
	tagName: "span",
});

/** The `||` delimiters */
const spoilerDelimiterDecoration = Decoration.mark({
	class: "inline_spoilers-editor-spoiler-delimiter",
	tagName: "span",
});

class SpoilerEditorPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	destroy() { }

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		const ranges: { from: number, to: number, isDelimiter: boolean }[] = [];

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					const text = view.state.sliceDoc(node.from, node.to);
					let match: RegExpExecArray | null;

					while ((match = SPOILER_REGEX.exec(text)) !== null) {
						const start = match.index;
						const end = start + match[0].length;

						const text = view.state.sliceDoc(start, end);

						if (!text.startsWith("||") && !text.endsWith("||")) {
							continue;  // sanity check
						}

						ranges.push({ from: start, to: start + 2, isDelimiter: true });
						ranges.push({ from: start + 2, to: end - 2, isDelimiter: false });
						ranges.push({ from: end - 2, to: end, isDelimiter: true });
					}
				},
			});
		}

		// Sort ranges by `from` position to prevent Codemirror error
		ranges.sort((a, b) => a.from - b.from);

		// Add sorted ranges to the builder
		for (const range of ranges) {
			builder.add(range.from, range.to, range.isDelimiter ? spoilerDelimiterDecoration : spoilerDecoration);
		}

		return builder.finish();
	}
}

const pluginSpec: PluginSpec<SpoilerEditorPlugin> = {
	decorations: (value: SpoilerEditorPlugin) => value.decorations,
};

const spoilerEditorPlugin = ViewPlugin.fromClass(
	SpoilerEditorPlugin,
	pluginSpec
);

const editorPlugins: Extension[] = [];

const loadEditorPlugin = (workspace: Workspace) => {
	if (!editorPlugins.includes(spoilerEditorPlugin)) {
		editorPlugins.push(spoilerEditorPlugin);
	}

	workspace.updateOptions();
}

const unloadEditorPlugin = (workspace: Workspace) => {
	const index = editorPlugins.indexOf(spoilerEditorPlugin);
	if (index !== -1) {
		editorPlugins.splice(index, 1);
	}

	workspace.updateOptions();
}

/*
 * Settings
 */
interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
	enableEditorMode: boolean;
}

const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false,
	enableEditorMode: false,
}

class InlineSpoilerPluginSettingsTab extends PluginSettingTab {
	plugin: InlineSpoilerPlugin;

	constructor(app: App, plugin: InlineSpoilerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Reveal all spoilers')
			.setDesc('Always show all inline spoilers, regardless of whether they are clicked or not.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showAllSpoilers)
				.onChange(async (value) => {
					this.plugin.settings.showAllSpoilers = value;
					this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide spoilers in editor view (experimental)')
			.setDesc('Hide spoilers in the editor until your cursor is on the same line as the spoiler.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableEditorMode)
				.onChange(async (value) => {
					this.plugin.settings.enableEditorMode = value;

					if (value) {
						loadEditorPlugin(this.app.workspace);
					} else {
						unloadEditorPlugin(this.app.workspace);
					}

					await this.plugin.saveSettings();
				}));
	}
}



/*
 * Obsidian plugin interface
 */
export default class InlineSpoilerPlugin extends Plugin {
	settings!: InlineSpoilerPluginSettings;

	async onload() {
		await this.loadSettings();

		const readingView = this.app.workspace.containerEl.querySelector(".markdown-reading-view");
		if (readingView) {
			updateReadingMode(readingView as HTMLElement, this);
		}

		this.registerMarkdownPostProcessor((element, ctx) => {
			updateReadingMode(element, this, ctx);
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'create-spoiler',
			name: 'Create spoiler',
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				editor.replaceSelection(`||${selection}||`);
			}
		});

		this.registerEditorExtension(editorPlugins);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new InlineSpoilerPluginSettingsTab(this.app, this));
	}

	onunload() {
		this.app.workspace.containerEl.classList.remove("inline_spoilers-revealed");
		unloadReadingMode(this.app.workspace);
		unloadEditorPlugin(this.app.workspace);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<InlineSpoilerPluginSettings>);
		this.app.workspace.containerEl.toggleClass("inline_spoilers-revealed", this.settings.showAllSpoilers);
		if (this.settings.enableEditorMode) {
			editorPlugins.push(spoilerEditorPlugin);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
