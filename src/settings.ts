/*
 * Settings
 */
/** How hidden spoilers are obscured */
export const SPOILER_STYLES = {
	solid: 'Solid',
	blur: 'Blur',
} as const;

/** The colour of hidden spoilers */
export const SPOILER_COLOURS = {
	code: 'Follow code block color',
	accent: 'Follow accent color',
} as const;

export const isValidSpoilerStyle = (value: unknown): value is keyof typeof SPOILER_STYLES => {
	return typeof value === 'string' && value in SPOILER_STYLES;
};

export const isValidSpoilerColor = (value: unknown): value is keyof typeof SPOILER_COLOURS => {
	return typeof value === 'string' && value in SPOILER_COLOURS;
};

export interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
	enableEditorMode: boolean;
	spoilerStyle: keyof typeof SPOILER_STYLES;
	spoilerColor: keyof typeof SPOILER_COLOURS;
}

export const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false,
	enableEditorMode: false,
	spoilerStyle: 'solid',
	spoilerColor: 'code',
};
