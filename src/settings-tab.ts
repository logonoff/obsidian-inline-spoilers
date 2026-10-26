import {
	PluginSettingTab,
	type App,
	type SettingDefinitionItem,
} from 'obsidian';
import type InlineSpoilerPlugin from './main';
import { configureEditorMode } from './editor-mode';
import {
	InlineSpoilerPluginSettings,
	isValidSpoilerColor,
	isValidSpoilerStyle,
	SPOILER_COLOURS,
	SPOILER_STYLES,
} from './settings';

export class InlineSpoilerPluginSettingsTab extends PluginSettingTab {
	plugin: InlineSpoilerPlugin;

	constructor(app: App, plugin: InlineSpoilerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<
		keyof InlineSpoilerPluginSettings
	>[] {
		return [
			{
				name: 'Reveal all spoilers',
				desc: 'Always show all inline spoilers, regardless of whether they are clicked or not.',
				control: {
					type: 'toggle',
					key: 'showAllSpoilers',
					defaultValue: false,
				},
			},
			{
				name: 'Hide spoilers in editor view (beta)',
				desc: 'Hide spoilers in the editor until your cursor is on the same line as the spoiler.',
				control: {
					type: 'toggle',
					key: 'enableEditorMode',
					defaultValue: false,
				},
			},
			{
				name: 'Spoiler color',
				desc: 'The color of hidden spoilers.',
				control: {
					type: 'dropdown',
					key: 'spoilerColor',
					options: SPOILER_COLOURS,
					defaultValue:
						'accent' satisfies keyof typeof SPOILER_COLOURS,
				},
			},
			{
				name: 'Spoiler style',
				desc: 'How hidden spoilers are obscured.',
				control: {
					type: 'dropdown',
					key: 'spoilerStyle',
					options: SPOILER_STYLES,
					defaultValue: 'solid' satisfies keyof typeof SPOILER_STYLES,
				},
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case 'showAllSpoilers':
				if (typeof value !== 'boolean') return;
				this.plugin.settings.showAllSpoilers = value;
				this.app.workspace.containerEl.toggleClass(
					'inline_spoilers-revealed',
					value,
				);
				break;
			case 'enableEditorMode':
				if (typeof value !== 'boolean') return;
				this.plugin.settings.enableEditorMode = value;
				configureEditorMode(value, this.app.workspace);
				break;
			case 'spoilerStyle':
				if (!isValidSpoilerStyle(value)) return;
				this.plugin.settings.spoilerStyle = value;
				break;
			case 'spoilerColor':
				if (!isValidSpoilerColor(value)) return;
				this.plugin.settings.spoilerColor = value;
				break;
			default:
				return;
		}

		await this.plugin.saveSettings();
	}
}
