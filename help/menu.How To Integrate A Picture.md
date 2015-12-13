# How to integrate a Picture in OSMBC

Use an article to integrate a picture. You can collect different picture ideas / links in the collection, but the rendering of the picture is taken out of the markdown, so it can be language specific, and it has to be copied and translated.

Add the picture to the categorie picture and use only one article in this category.

Pictures in weekly and wochennotiz are using the Word Press classes wp-caption and wp-caption text. OSMBC tries to generate them direct out of the markdown, and ignores the in between step from WP with [caption].

The markdown looks as follows:
```
![Alternative Text](https://this is a picture link =300x200)

Some caption text allowing superscript [^[1]^](#WN271_wetterabhängige_Karte)
```

## Reference The Picture
The first line contains the markdown for the picture. The AltText for the picture has to be written in [], the picture link in (). Please include the size of the picture with the =WxH. This size is used to calculate the size of the caption (W +10px).

The second line contains the caption text. Please use a empty line, to force markdown to generate an additional <p>.

## Write The Caption

You can use normal markdown. As in the example, you can use ^ for superscript. Every article is referenced with an ID in the generated markdown, the ID is the number of the Weekly / Wochennotiz (preceeded by a WN) and the title of the article. The ID is in lower capital and spaces are exchanged by _.

## The Result

As a result the following is generated

```
<div style="width: 310px" class="wp-caption alignnone"> 
<p class="wp-caption-text">
  <img src="https://picture.png" alt="Alternative Text" width="300" height="200">
  Some caption text allowing superscript <a href="#WN271_wetterabh%C3%A4ngige_Karte"><sup>[1]</sup></a>
</p>

</div>
```

