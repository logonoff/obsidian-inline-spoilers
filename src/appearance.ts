import type { InlineSpoilerPluginSettings } from './settings';
import { SPOILER_COLOURS, SPOILER_STYLES } from './settings';

/*
 * Appearance
 */
const STYLE_CLASSES = [
	...Object.keys(SPOILER_STYLES).map(
		(style) => `inline_spoilers-style-${style}`,
	),
	...Object.keys(SPOILER_COLOURS).map(
		(color) => `inline_spoilers-colour-${color}`,
	),
];

/** Applies the appearance settings to a (main or popout) window's document */
export const applyAppearance = (
	doc: Document,
	settings: InlineSpoilerPluginSettings,
) => {
	removeAppearance(doc);

	doc.body.addClass(
		`inline_spoilers-style-${settings.spoilerStyle}`,
		`inline_spoilers-colour-${settings.spoilerColor}`,
	);
};

export const removeAppearance = (doc: Document) => {
	doc.body.removeClasses(STYLE_CLASSES);
};
