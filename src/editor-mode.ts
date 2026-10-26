import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
	Decoration,
	ViewPlugin,
	type DecorationSet,
	type EditorView,
	type PluginSpec,
	type PluginValue,
	type ViewUpdate,
} from '@codemirror/view';
import type { Workspace } from 'obsidian';

/*
 * Editor mode
 */
const SPOILER_REGEX = /\|\|(.+?)\|\|/g;

/**
 * Returns whether a syntax tree node represents inline code or a code block.
 * Matching by name also covers code node names supplied by Obsidian.
 *
 * @param nodeName - The name of a CodeMirror syntax tree node.
 * @returns `true` when the node's source range should be excluded from spoilers.
 */
const isCodeNode = (nodeName: string): boolean =>
	nodeName.toLowerCase().includes('code');

/** The spoiler content between the `||` delimiters */
const spoilerDecoration = Decoration.mark({
	class: 'inline_spoilers-editor-spoiler',
	tagName: 'span',
});

/** The `||` delimiters */
const spoilerDelimiterDecoration = Decoration.mark({
	class: 'inline_spoilers-editor-spoiler-delimiter',
	tagName: 'span',
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

	destroy() {}

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		const ranges: { from: number; to: number; isDelimiter: boolean }[] = [];

		for (const { from, to } of view.visibleRanges) {
			const codeRanges: { from: number; to: number }[] = [];
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					if (isCodeNode(node.name)) {
						codeRanges.push({ from: node.from, to: node.to });
					}
				},
			});

			// Search each non-code segment independently so delimiters cannot
			// pair across inline code or a code block.
			let segmentFrom = from;
			for (const codeRange of codeRanges.sort(
				(a, b) => a.from - b.from,
			)) {
				const codeFrom = Math.max(from, codeRange.from);
				const codeTo = Math.min(to, codeRange.to);
				if (segmentFrom < codeFrom) {
					this.addSpoilerRanges(view, segmentFrom, codeFrom, ranges);
				}
				segmentFrom = Math.max(segmentFrom, codeTo);
			}
			if (segmentFrom < to) {
				this.addSpoilerRanges(view, segmentFrom, to, ranges);
			}
		}

		// Sort ranges by `from` position to prevent Codemirror error
		ranges.sort((a, b) => a.from - b.from);

		// Add sorted ranges to the builder
		for (const range of ranges) {
			builder.add(
				range.from,
				range.to,
				range.isDelimiter
					? spoilerDelimiterDecoration
					: spoilerDecoration,
			);
		}

		return builder.finish();
	}

	/**
	 * Adds spoiler decorations for matches wholly inside a source range.
	 *
	 * @param view - The editor view that owns the document.
	 * @param from - The inclusive start position in the document.
	 * @param to - The exclusive end position in the document.
	 * @param ranges - The list to receive delimiter and spoiler ranges.
	 */
	private addSpoilerRanges(
		view: EditorView,
		from: number,
		to: number,
		ranges: { from: number; to: number; isDelimiter: boolean }[],
	) {
		const text = view.state.sliceDoc(from, to);
		SPOILER_REGEX.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = SPOILER_REGEX.exec(text)) !== null) {
			const start = from + match.index;
			const end = start + match[0].length;
			ranges.push(
				{ from: start, to: start + 2, isDelimiter: true },
				{ from: start + 2, to: end - 2, isDelimiter: false },
				{ from: end - 2, to: end, isDelimiter: true },
			);
		}
	}
}

const pluginSpec: PluginSpec<SpoilerEditorPlugin> = {
	decorations: (value: SpoilerEditorPlugin) => value.decorations,
};

const spoilerEditorPlugin = ViewPlugin.fromClass(
	SpoilerEditorPlugin,
	pluginSpec,
);

export const editorPlugins: Extension[] = [];

export const configureEditorMode = (
	enabled: boolean,
	workspace?: Workspace,
) => {
	const index = editorPlugins.indexOf(spoilerEditorPlugin);
	if (enabled && index === -1) {
		editorPlugins.push(spoilerEditorPlugin);
	} else if (!enabled && index !== -1) {
		editorPlugins.splice(index, 1);
	}

	workspace?.updateOptions();
};
