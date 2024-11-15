import ts from "typescript-eslint";
import js from "@eslint/js";
import globals from "globals";

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	{
		languageOptions: {
			globals: globals.node
		},
	},
	{
    	ignores: ["**/node_modules/", "**/main.js"],
	}
);
