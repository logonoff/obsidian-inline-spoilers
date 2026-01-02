import globals from "globals";
import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import ts from "typescript-eslint";
import { globalIgnores } from "eslint/config";

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.mjs",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
