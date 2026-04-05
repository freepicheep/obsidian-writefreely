# WriteFreely for Obsidian

This Obsidian plugin lets you publish and manage your posts on [WriteFreely](https://writefreely.org/). 

![demo](https://github.com/user-attachments/assets/5dd427ff-410d-4087-8cb1-a0a455c03c81)

## Installation

Because this plugin isn't oficially in the Obsidian plugin list (yet), you must install it directly from the repo. I recommend using the excellent BRAT plugin.

1. [Install BRAT](https://obsidian.md/plugins?search=brat)
2. Copy the link to this Git repository: `https://github.com/freepicheep/obsidian-writefreely`
3. Follow [these instructions](https://tfthacker.com/brat-quick-guide#Adding+a+beta+plugin)

## Authentication

You only need:
1. Your WriteFreely instance url (e.g. `https://write.as`)
2. Username
3. Password

The plugin does not store your username or password: it stores the authentication token in Obsidian's new SecretStorage.

## Usage

You can save your note as a draft, publish it to your collection, or remove it if you have already published it. You can use the available commands from the Command Palette or click on the WriteFreely items in the toolbar or statusbar. 

The WriteFreely post metadata is stored in your notes YAML front matter (Obsidian Properties). This means you can make an [Obsidian Base](https://obsidian.md/help/bases) to view all your WriteFreely posts or query them using [Dataview](https://blacksmithgu.github.io/obsidian-dataview/).
