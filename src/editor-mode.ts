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

						if (!text.startsWith('||') && !text.endsWith('||')) {
							continue; // sanity check
						}

						ranges.push({
							from: start,
							to: start + 2,
							isDelimiter: true,
						});
						ranges.push({
							from: start + 2,
							to: end - 2,
							isDelimiter: false,
						});
						ranges.push({
							from: end - 2,
							to: end,
							isDelimiter: true,
						});
					}
				},
			});
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
