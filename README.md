# Handy Image (Hardened)

Security-focused fork of [Owyn/HandyImage](https://github.com/Owyn/HandyImage), based on upstream commit `d882ad97da3845e24e8851fa7a92f47135281e98`.

## Install in Firefox with Tampermonkey

1. Disable or remove the original **Handy Image** script in Tampermonkey's dashboard. Do not run both versions.
2. Open [the fork's userscript](https://raw.githubusercontent.com/mike-batrakov/HandyImage/master/HandyImage.user.js) and install **Handy Image (Hardened)**. For a reviewed snapshot, substitute its full commit SHA for `master` in that URL.
3. Check that the new name and namespace identify this fork. Its separate identity starts with separate settings; do not import the original script's stored values.
4. Keep **Check for updates** / **Automatic installation** disabled for this script. Both update directives are `none`; install reviewed fork versions manually. Tampermonkey overrides may take precedence.
5. Prefer Tampermonkey's **Browser API** download mode for Save As prompts, and keep its download permissions and extension whitelist restrictions enabled.
6. Exclude sites you do not use. Keep ad/tracking blockers enabled. Popup cleanup is not a guarantee that host scripts cannot run.

## Security changes

- Removed persisted JavaScript evaluation and the Custom JS Action editor. Existing stored `js` values are never loaded or executed.
- Favorite tags remain available as comma-separated text in configuration, for example `solo, animal_ears, horse`. Text is never interpreted as code.
- Ignore page-generated keyboard events and synthetic configuration Save clicks.
- Capture the selected download URL before displaying the viewer; later changes to the image/video DOM cannot replace it.
- Accept only credential-free HTTP(S) download/direct-navigation URLs and omit the explicit full-page Referer override. Some hosts with strict hotlink checks may refuse downloads; try the normal page or browser Save Image As instead.
- Validate background colors before inserting them into the viewer stylesheet.
- Use a distinct script name/namespace, disable automatic updates, and do not run in embedded frames.

The host-specific viewer remains based on upstream. These fixes address the reviewed paths; they do not certify every host or future change as safe. The ordinary display configuration is still page-visible, so a live host script may alter display inputs before a genuine Save. It cannot use these controls to store executable code.

## Verification

Run `node --test tests/security.test.cjs` for dependency-free security regressions. The Firefox integration fixture requires Playwright and its Firefox browser: run `node tests/browser.security.cjs`. Optional `HANDYIMAGE_PLAYWRIGHT_PATH` and `HANDYIMAGE_FIREFOX_EXECUTABLE` variables select an existing installation. Fixtures route all page/media requests locally in an isolated browser context and mock GM APIs; they do not reproduce the installed Tampermonkey extension's sandbox, update loader, or native download subsystem.

## Upstream features

<h3>Features</h3>
<p>This script leaves just the image (largest available version) on pages of <strong>many image hosting sites</strong> skipping all the annoying stuff like ads, "continue to image" etc and <strong>disabling</strong> any kind of <strong>pop-ups</strong>. (script for images opened directly in browser can be found <a href=https://github.com/Owyn/Center_Image>here</a> - if you like centering of image, autoresize and hotkeys)</p>

<ul><li><strong>Hotkeys</strong> - very handy ones</li>
<li><strong>fullsizing</strong> image to its largest available version when opened, <strong>nothing else</strong> than image</li>
<li><strong>autofit</strong> to screen big images by default (larger than screen both vertically and horizontally)</li>
<li><strong>address</strong> of page doesn't change so you still can copy\share it</li>
<li><strong>image centering</strong> (like in firefox) - pretty usefull on wide monitors</li>
<li><strong>configurable</strong> - choose background color, image fitting, and favorite tags for filenames</li>
<li><strong>fast</strong> - does its job before page loads its resources (or run JavaScripts in FireFox)</li>
<li><strong>fail-safe</strong> - if it didn't find image to fullsize - it won't do anything to mess the page up and will try again in few sec.</li></ul>

<h3>Hotkeys</h3>
<ul>
<li><strong>WASD</strong> \ <strong>arrows</strong> \ <strong>num4862</strong> - scroll image to right\left\top\bottom accordingly</li>
<li><strong>Q</strong> \ <strong>num5</strong> \ <strong>click on image</strong> - resize image from full-window-size to original and vica versa</li>
<li><strong>Tab</strong> \ <strong>Enter</strong> \ <strong>Middle Mouse Click on image</strong> - resize image to fill the window with it or return it to original</li>
<li><strong>ctrl+space</strong> and <strong>ctrl+shift+space</strong> - simular to scroll of spacebar but horizontally</li>
<li><strong>P</strong> \ <strong>menu item</strong> in (tamper\grease)monkey icon - open configuration menu</li>
<li><strong>R</strong> - reload page with script disabled (to see comments etc)</li>
<li><strong>F</strong> - fullscreen mode (for videos)</li>
<li><strong>M</strong> - mute audio (for videos)</li>
<li><strong>ctrl + S</strong> - save image\video (same as when you right click the image and press save as),<br>
on booru sites it automatically puts artist and character tags into saved filename. To add favorite tags, enter comma-separated names in configuration, e.g. <code>solo, animal_ears, horse</code>.<br>
to have the "save as" dialogue where you choose or correct the filename yourself instead of having the file downloaded right away - you have to set <code>download mode</code> to <code>Browser API</code> in TM -> dashboard -> settings: 
<img src=https://github.com/Owyn/HandyImage/assets/1309656/2419da42-9a5c-4200-bb9c-aa02e0616632></li>
</ul>

<h3>Supported browsers:</h3>
<img width="128" height="128" alt="Chrome" src="https://github.com/user-attachments/assets/7c5aed3d-9945-4c15-a769-9997b9730a6a" />
<img width="128" height="128" alt="Firefox" src="https://github.com/user-attachments/assets/999bf8f6-d336-48a9-88c9-2b09a6e24ee9" />


You need a userscript manager to install and use the script, e.g. <a href="https://www.tampermonkey.net/">TamperMonkey</a> (might not work in other less-pupular and less-maintained ones)

<h3>How to request a new imagehost support or fix for old one</h3>
<p>Please, if you would like to request a new site or report a non-working one, please, remember to write at least ONE image URL where the script should work, then head right to <strong><a href="https://github.com/Owyn/HandyImage/issues">Feedback section</a></strong>.</p>

<p>In the topic title, write "fix" if the site is already on the list or "add" if it is a new request, and the domain (eg: add googleimagehost.com)</p>

<em>* But keep in mind that when requesting nameless non-popular image hosting google knows not much about you'd have to provide a reason for adding it - a website url which uses that hosting a lot for images</em>
<br><em>** Or if you are a developer yourself and would like to help add new hosts, you can <a href="https://github.com/Owyn/HandyImage/blob/master/Tutorial:%20adding%20new%20imagehosts%20support.md">submit code edits</a> at <a href="https://github.com/Owyn/HandyImage">GitHub page</a></em>

<br>
<h3>If the userscript fails for some website:</h3>
<p>Use the R hotkey to reload the normal page, or exclude that site from the script. Keep your ad blocker enabled.
</p>
<img src=https://user-images.githubusercontent.com/1309656/199995950-68fdb2c3-d11c-4b2a-ac34-a6e969b893cb.png>


<br>
<h3>If you see a placeholder instead of an image:</h3>
<p>Check the image URL or reload the normal page. Keep tracking protection and privacy extensions enabled.
</p>
<img src=https://user-images.githubusercontent.com/1309656/199995080-a2d4d769-3ae9-44da-9ea6-87504ef74bbe.png>
