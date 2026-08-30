# HTML2PDF4DOC

`html2pdf4doc` is a JavaScript tool that allows you to print HTML pages or specific
sections of them with precision. It ensures accurate printing by dividing the
selected HTML content into printable pages and providing a preview in a browser.
Additionally, you have the option to customize the printed pages by adding a
front page and running titles according to your preferences.

Key features of HTML2PDF4DOC include:

- Precise printing of HTML pages or fragments, supporting various formats
  (default A4).
- The focus of the tool is printing documents that have titles, chapters,
  paragraphs, etc. Non-document content should be also supported just fine.
- Careful formatting and page splitting based on the logical content of a
  document: avoiding hanging lines, accurate printing of multipage tables, etc.
- The tool accurately renders HTML pages, showcasing exactly how they will
  appear on the printed page.
- It also offers a Python API, allowing you to programmatically print HTML to
  PDF.

With HTML2PDF4DOC, you can achieve high-quality printed outputs of your HTML content
while maintaining control over the formatting and layout.

## Building and running on localhost

First install dependencies:

```sh
npm install
```

To create a production build:

```sh
npm run build
```

To create a development build:

```sh
npm run start
```

## Running

```sh
node dist/bundle.js
```

## Testing

To run unit tests:

```sh
npm test
```

End-to-end tests are orchestrated through the Python Invoke tasks in `tasks.py`.
Run them with:

```sh
invoke test-end2end
```

Pass exactly one of the browser mode flags when you need to control how the
tests launch the browser:

- `invoke test-end2end --headless` — default headless mode (no visible window).
- `invoke test-end2end --headless2` — alternate headless backend used on some CI
  setups.
- `invoke test-end2end --headed` — run with a visible browser for debugging.

The same flags are available for the randomized suite (`invoke
test-end2end-random`) and the short alias (`invoke te`).

## Testing web server

To run the web server:

```sh
npm run test_server
```

Open server at http://192.168.0.10:8080/test/unit/test.html.

## HTML2PDF4DOC API

### Programmatic initialization

HTML2PDF4DOC can be initialized from JavaScript by loading the script with
`data-init="manual"` and then calling `HTML2PDF4DOC.init()`.

```html
<script data-init="manual" src="html2pdf4doc.min.js"></script>
<script>
  HTML2PDF4DOC.init({
    printPaperSize: 'A4',
  });
</script>
```

Programmatic options override options from the script tag.

### Waiting for async page rendering

HTML2PDF4DOC starts early enough in the page lifecycle to show its loading
spinner. It does not measure the final document dimensions or paginate the
printable content until after the browser `window.load` event.

If the page performs additional asynchronous rendering after `load` (for example
Mermaid or PlantUML diagrams), pass a `renderReady` option to
`HTML2PDF4DOC.init()`.

`renderReady` can be a promise, a function that returns a promise, or an array of
promises. HTML2PDF4DOC waits for it after `window.load` and before it measures
or changes the printable DOM.

```html
<script data-init="manual" src="html2pdf4doc.min.js"></script>
<script>
  HTML2PDF4DOC.init({
    renderReady: async () => {
      await Promise.all([
        mermaid.run(),
        renderPlantumlBlocks(),
      ]);
    },
  });
</script>
```

## How it works

Here is a general overview of what HTML2PDF4DOC does:

1. Using the CSS, it is possible to isolate a part of the page and allow the
   printer to print only that content.
2. Right in the browser, HTML2PDF4DOC shows how the printer will print content
   pages.
3. Since the printer inserts page breaks based solely on geometry, including in
   unexpected places, reading the printed document can be inconvenient. For
   example, a heading may be split from a paragraph, leaving a single hanging
   line at the end of a page, or a page may start with the last line or word of
   a paragraph, and so on. The algorithm handles such cases and determines where
   the printer needs to insert page breaks.
4. The resulting PDF can be enhanced by adding running titles, page numbers, and
   a cover page. This customization can be done using HTML templates.

### How HTML2PDF4DOC works with DOM

HTML2PDF4DOC attaches to an existing page and modifies its DOM to transform it into
a printable page.

HTML2PDF4DOC starts early in the page lifecycle so it can show its loading
spinner while the page is still settling. After the page has finished loading,
and after the optional `renderReady` programmatic option completes, it measures
the final DOM dimensions and starts paginating the printable content.

Users can choose specific content for printing, and if nothing is selected, the
whole page will be prepared for printing. To mark a particular HTML block as
printable, add the html2pdf4doc attribute to its tag.

### Two layers

When HTML2PDF4DOC processes an HTML page, it creates two layers:

1. **Paper flow** which is a layer with pages that visualizes the preview of the
   page for printing. The pages in this layer are blank white pages showing the
   geometry of the printed output.
2. **Content flow** which is a content layer with the user content that is split
   and arranged according to the pages of the layer 1.

The algorithm does the following:

- If only a specific HTML block/tag is selected for printing with `[html2pdf4doc]`,
  it marks all other HTML tags as "don't print".
- It takes the inner content of the tag marked with `[html2pdf4doc]` out of the DOM.
  Let's call this content **printable content**.
- It processes the printable content and brings the updated content back to the
  DOM, in the form of the Content flow layer.
- At the same time, using `position: absolute`, the Paper flow layer is put
  behind the Content flow layer to provide a preview of how the printed content
  will look like on paper.

The main task and the challenge of the algorithm is to find the points where the
content must be split into separate pages.

### HTML layout edge cases

The algorithm considers several edge cases separately, for example, how to split
paragraphs of text, tables, multi-page tables, images, etc. If your document has
a sophisticated structure with a large number of non-trivially positioned
elements, the algorithm may produce unexpected results. In that case, the
algorithm will still visualize the result of its work, and you will be able to
see that something went wrong at a certain point. It is part of the project's
roadmap to implement as many such corner cases as possible.

### Estimating page content size

The algorithm knows exactly what are the physical dimensions of a printed page
based on a format selected by a user (i.e. the A4, A5 or A3 pages).

To estimate how much content can fit into a single page, the algorithm traverses
the content DOM top-down recursively, only descending into the child tags if
there is an opportunity for a smarter splitting of the content between pages.

For every given tag, the algorithm decides if it can place this tag on a current
page. If the whole tag's content fits into the page, the algorithm places it
entirely. If the tag's content only partially fits the page, the algorithm tries
to split the tag into two parts, one for this page and one for the next page.

In some cases, for example when handling an image that does not fit into one
page, the algorithm can downscale the image with a certain tolerance (currently,
to no less than 80% of the image's original size).

# Copyright

Copyright (c) 2021-2026 Maryna Balioura mettta@gmail.com.
