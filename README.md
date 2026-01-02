# Inline spoilers for Obsidian

[![Plugin version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Flogonoff%2Fobsidian-inline-spoilers%2Frefs%2Fheads%2Fmaster%2Fmanifest.json&query=version&label=version)](https://github.com/logonoff/obsidian-inline-spoilers/blob/master/manifest.json)
[![Minimum Obsidian version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Flogonoff%2Fobsidian-inline-spoilers%2Frefs%2Fheads%2Fmaster%2Fmanifest.json&query=minAppVersion&logo=obsidian&label=obsidian&color=%237C3AED)](https://obsidian.md/plugins?id=inline-spoilers)
[![GitHub License](https://img.shields.io/github/license/logonoff/obsidian-inline-spoilers?color=%23a32d2a)](https://github.com/logonoff/obsidian-inline-spoilers/blob/master/LICENSE.md)
[![GitHub Repo stars](https://img.shields.io/github/stars/logonoff/obsidian-inline-spoilers)](https://github.com/logonoff/obsidian-inline-spoilers)

This plugin adds support for inline spoilers in [Obsidian](https://obsidian.md)
using the `||` syntax.

![Demo gif](https://i.imgur.com/YyfMuJt.gif)

## Usage

To create an inline spoiler, wrap the text you want to hide in `||`, or by performing
the **Inline spoilers: Create spoiler** command. For example:

```md
||This text will be hidden||
```

If you want to combine various formatting options, you can nest them, but make
sure they are outside the spoiler:

```md
**||This text will be hidden and bolded||**

*||This text will be hidden and italicized||*
```

To reveal or hide a spoiler, click on it. You may opt to always show all spoilers
by enabling the **Always show spoilers** setting.

## Theming

There are CSS variables and classes you can use to style spoilers to your liking.
These can be used in a CSS snippet to override to customize the appearance of spoilers,
without needing to modify the plugin.

Refer to the [styles.css] file for more details.

## Bugs and feature requests

Please report any bugs or request features on the [GitHub issues page]. The plugin
author is no longer an active Obsidian user, the best way to get a feature or bug
fix implemented is to submit a pull request. Contributions are always welcome :)

Stars on GitHub are also appreciated!

[styles.css]: https://github.com/logonoff/obsidian-inline-spoilers/blob/master/styles.css
[GitHub issues page]: https://github.com/logonoff/obsidian-inline-spoilers/issues
