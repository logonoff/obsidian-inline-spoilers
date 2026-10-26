import {
	MarkdownView,
	type MarkdownPostProcessorContext,
	type Plugin,
	type Workspace,
} from 'obsidian';
import { findDelimiterPairs, findEscapedDelimiters } from './spoiler-syntax';

/** Allowed HTML tags to process for spoilers */
const TAGS =
	'p, li, h1, h2, h3, h4, h5, h6, blockquote, em, strong, b, i, a, th, td';

/*
 * Reading mode
 */
/**
 * Finds which child node of `parent` contains the character at `offset`
 * within the parent's concatenated textContent, and returns the child node
 * along with the local offset within that child's textContent.
 */
const findChildAtOffset = (
	parent: Node,
	offset: number,
): { node: Node; localOffset: number } | null => {
	let cumulative = 0;
	for (const child of Array.from(parent.childNodes)) {
		const len = child.textContent?.length ?? 0;
		if (offset < cumulative + len) {
			return { node: child, localOffset: offset - cumulative };
		}
		cumulative += len;
	}
	return null;
};

export const rerenderExistingReadingView = (workspace: Workspace) => {
	const readingView = workspace.containerEl.querySelector(
		'.markdown-reading-view',
	);
	if (!readingView) return;

	workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view;
		if (
			view instanceof MarkdownView &&
			view.getMode() === 'preview' &&
			view.containerEl.contains(readingView)
		) {
			view.previewMode.rerender(true);
		}
	});
};

const processElement = (
	element: Node,
	escapedDelimiters: Set<number>,
	delimiterCounter: { value: number },
	processedElements: WeakSet<Node>,
) => {
	if (element.nodeType !== Node.ELEMENT_NODE) return;
	if (processedElements.has(element)) return;
	processedElements.add(element);

	const htmlElement = element as HTMLElement;
	if (htmlElement.matches('code, pre')) {
		// Keep delimiter ordinals in step with the source scan, but never render
		// spoilers from code content.
		findDelimiterPairs(
			element.textContent ?? '',
			escapedDelimiters,
			delimiterCounter,
		);
		return;
	}

	// Don't process nodes that are already spoiler spans
	if (
		element.instanceOf(HTMLElement) &&
		element.classList.contains('inline_spoilers-spoiler')
	)
		return;

	const fullText = element.textContent ?? '';
	if (!fullText.includes('||')) return;

	// Parent textContent includes inline code. Process its children separately
	// so spoiler delimiters cannot match through code content.
	if (htmlElement.querySelector('code, pre')) {
		for (const child of Array.from(element.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				processTextNode(child, escapedDelimiters, delimiterCounter);
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				processElement(
					child,
					escapedDelimiters,
					delimiterCounter,
					processedElements,
				);
			}
		}
		return;
	}

	// Save counter state so we can replay it for the actual processing
	const savedCounter = delimiterCounter.value;

	// Find all valid (non-escaped) spoiler matches
	const validMatches = findDelimiterPairs(
		fullText,
		escapedDelimiters,
		delimiterCounter,
	);
	const scannedCounter = delimiterCounter.value;

	if (validMatches.length === 0) {
		// No spoilers at this level, recurse into child elements
		// Reset counter since findDelimiterPairs already advanced it
		delimiterCounter.value = savedCounter;
		for (const child of Array.from(element.childNodes)) {
			if (child.nodeType === Node.ELEMENT_NODE) {
				processElement(
					child,
					escapedDelimiters,
					delimiterCounter,
					processedElements,
				);
			}
		}
		delimiterCounter.value = Math.max(
			delimiterCounter.value,
			scannedCounter,
		);
		return;
	}

	// Check if all matches fall within single text nodes (simple case)
	const allInTextNodes = validMatches.every((m) => {
		const startInfo = findChildAtOffset(element, m.start);
		const endInfo = findChildAtOffset(element, m.end - 1);
		return (
			startInfo &&
			endInfo &&
			startInfo.node === endInfo.node &&
			startInfo.node.nodeType === Node.TEXT_NODE
		);
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
				processElement(
					child,
					escapedDelimiters,
					delimiterCounter,
					processedElements,
				);
			}
		}
		delimiterCounter.value = Math.max(
			delimiterCounter.value,
			scannedCounter,
		);
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
		if (
			startNode.nodeType === Node.TEXT_NODE &&
			startInfo.localOffset > 0
		) {
			(startNode as Text).splitText(startInfo.localOffset);
			firstWrappedNode = startNode.nextSibling!;
		}

		// Split the ending text node if the || delimiter doesn't end at the end
		let lastWrappedNode = endNode;
		if (endNode.nodeType === Node.TEXT_NODE) {
			const endLocalOffset = endInfo.localOffset + 1;
			const endText = endNode.textContent ?? '';
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

		const spoilerSpan = createSpan({ cls: 'inline_spoilers-spoiler' });

		// Insert the spoiler span before the first node to wrap
		element.insertBefore(spoilerSpan, nodesToWrap[0]);

		// Move nodes into the spoiler span, stripping the || delimiters
		for (const wrappedNode of nodesToWrap) {
			spoilerSpan.appendChild(wrappedNode);
		}

		// Remove the leading || from the first child
		const firstChild = spoilerSpan.firstChild;
		if (
			firstChild &&
			firstChild.nodeType === Node.TEXT_NODE &&
			firstChild.textContent
		) {
			firstChild.textContent = firstChild.textContent.replace(
				/^\|\|/,
				'',
			);
		}

		// Remove the trailing || from the last child
		const lastChild = spoilerSpan.lastChild;
		if (
			lastChild &&
			lastChild.nodeType === Node.TEXT_NODE &&
			lastChild.textContent
		) {
			lastChild.textContent = lastChild.textContent.replace(/\|\|$/, '');
		}
	}

	// Recurse into any remaining non-spoiler child elements
	for (const child of Array.from(element.childNodes)) {
		if (
			child.nodeType === Node.ELEMENT_NODE &&
			!(
				child.instanceOf(HTMLElement) &&
				child.classList.contains('inline_spoilers-spoiler')
			)
		) {
			processElement(
				child,
				escapedDelimiters,
				delimiterCounter,
				processedElements,
			);
		}
	}
};

/**
 * Processes a single text node, splitting it by ||spoiler|| patterns and
 * wrapping matched segments in spoiler spans.
 */
const processTextNode = (
	node: Node,
	escapedDelimiters: Set<number>,
	delimiterCounter: { value: number },
) => {
	if (!node.textContent || !node.parentNode) return;

	const text = node.textContent;
	const validMatches = findDelimiterPairs(
		text,
		escapedDelimiters,
		delimiterCounter,
	);

	if (validMatches.length === 0) return;

	const fragment = createFragment();
	let lastIndex = 0;

	for (const { start, end } of validMatches) {
		// Add any text before this match
		if (start > lastIndex) {
			fragment.appendChild(
				document.createTextNode(text.slice(lastIndex, start)),
			);
		}

		// Create the spoiler span (strip the || delimiters)
		const spoilerText = text.slice(start + 2, end - 2);
		const spoilerSpan = createSpan({
			cls: 'inline_spoilers-spoiler',
			text: spoilerText,
		});
		fragment.appendChild(spoilerSpan);

		lastIndex = end;
	}

	// Add any remaining text after the last match
	if (lastIndex < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
	}

	// Replace the original text node with the new fragment
	node.parentNode.replaceChild(fragment, node);
};

export const updateReadingMode = (
	element: HTMLElement,
	plugin: Plugin,
	ctx?: MarkdownPostProcessorContext,
) => {
	// Compute which ordinal || delimiters are escaped in the raw markdown source.
	// getSectionInfo returns the full document text along with lineStart/lineEnd
	// for the section, so we extract just the relevant lines.
	let escapedDelimiters = new Set<number>();
	if (ctx) {
		const sectionInfo = ctx.getSectionInfo(element);
		if (sectionInfo) {
			const lines = sectionInfo.text.split('\n');
			const sectionText = lines
				.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1)
				.join('\n');
			escapedDelimiters = findEscapedDelimiters(sectionText);
		}
	}

	const allowedElems = element.findAll(TAGS);
	const delimiterCounter = { value: 0 };
	const processedElements = new WeakSet<Node>();

	for (const elem of allowedElems) {
		// Process each child node of the element
		processElement(
			elem,
			escapedDelimiters,
			delimiterCounter,
			processedElements,
		);
	}

	const spoilers = element.findAll('.inline_spoilers-spoiler');

	for (const spoiler of spoilers) {
		plugin.registerDomEvent(spoiler, 'click', () => {
			spoiler.classList.toggle('inline_spoilers-revealed');
		});
	}
};

export const unloadReadingMode = (workspace: Workspace) => {
	// remove all spoilers from reader mode
	const spoilers = Array.from(
		workspace.containerEl.querySelectorAll<HTMLElement>(
			'.inline_spoilers-spoiler',
		),
	);

	for (const spoiler of spoilers) {
		const parent = spoiler.parentNode;
		if (!parent) continue;

		// Re-wrap the spoiler content with || delimiters, preserving child nodes
		const fragment = createFragment();
		fragment.appendChild(document.createTextNode('||'));
		while (spoiler.firstChild) {
			fragment.appendChild(spoiler.firstChild);
		}
		fragment.appendChild(document.createTextNode('||'));
		parent.replaceChild(fragment, spoiler);
	}
};
