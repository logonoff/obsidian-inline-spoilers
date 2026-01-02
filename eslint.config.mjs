import globals from "globals";
import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import ts from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
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
						'eslint.config.mjs',
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
