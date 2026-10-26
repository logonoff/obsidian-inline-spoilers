import { PluginSettingTab, Setting, type App } from 'obsidian';
import type InlineSpoilerPlugin from '../main';
import { configureEditorMode } from './editor-mode';
import { SPOILER_STYLES, type SpoilerStyle } from './settings';

export class InlineSpoilerPluginSettingsTab extends PluginSettingTab {
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
					this.app.workspace.containerEl.toggleClass('inline_spoilers-revealed', value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Hide spoilers in editor view (experimental)')
			.setDesc('Hide spoilers in the editor until your cursor is on the same line as the spoiler.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableEditorMode)
				.onChange(async (value) => {
					this.plugin.settings.enableEditorMode = value;
					configureEditorMode(value, this.app.workspace);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Spoiler style')
			.setDesc('How hidden spoilers are obscured.')
			.addDropdown(dropdown => dropdown
				.addOptions(SPOILER_STYLES)
				.setValue(this.plugin.settings.spoilerStyle)
				.onChange(async (value) => {
					this.plugin.settings.spoilerStyle = value as SpoilerStyle;
					await this.plugin.saveSettings();
					// show the strength setting that belongs to the new style
					this.display();
				}));
	}
}
