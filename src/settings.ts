/*
 * Settings
 */
/** How hidden spoilers are obscured */
export const SPOILER_STYLES = {
	accent: 'Follow accent color',
	blur: 'Blur',
} as const;

export type SpoilerStyle = keyof typeof SPOILER_STYLES;

export interface InlineSpoilerPluginSettings {
	showAllSpoilers: boolean;
	enableEditorMode: boolean;
	spoilerStyle: SpoilerStyle;
}

export const DEFAULT_SETTINGS: InlineSpoilerPluginSettings = {
	showAllSpoilers: false,
	enableEditorMode: false,
	spoilerStyle: 'accent',
};
