# OSMBC Instructions

## Principles

OSMBC is article based. Every single article in a blog is one object.

The article has the following properties:

* **title** 
  Used internally for display purposes only

* **collection**
  Free text (english / german) to describe the idea, or the collect the html link

* **markdownDE**
  german markdown text

* **markdownEN**
  english markdown text (no process for weekly defined yet)

* **markdownLANG**
  markdown text for other languages

* **blog**
  Reference to the blog number

* **categoryEN** 
  Reference to the category in the blog in english
  (categories can be redefined per blog)

## Typical Use Cases
### Login

OSMBC uses your OAUTH to login with your OpenStreetMap account. The OAUTH token is valid for one year.

### Collecting Information

Use 'collect' from the navbar to collect information.
Before you can collect an information in the appearing screen, you have to search, wether the article is already a part of a blog or not. Typically you collect a hyperlink, please post the hyperlink in the search box and press search.
A list of blogs containing the link will appear, or a zero result information will be shown.
Now you can decide to add the article to a blog. Please use a short title, as a very short summary of the content. The minimum information is a hyperlink in the collect field, some additional information would be helpfull for the other editors.
As the tool is international, please use english language for title and collection.
To save, press OK, than the edit view of the article is started.

### Writing articles

If you just want to write the articles, you have 2 possibilities. Under the Item **Article -> empty Text** you find all articles, that has no markdown text yet.
Similar the **no translation** can be used, to find any article without translation. Only open and review articles are shown.

Alternativ you can open the blog (via main page, navbar or blog menu in navbar).
This view offers several sights on a blog. There is a Nav Bar to change the view on a blog. This Navbar has 3 Parts


* Change Views on a blog

* Export HTML for WP

* Configure the Navbar (The gear on the right)

The Views have the following functionalities

* **overview**
Comments are show with a blue/red bar, depending on you are named in a comment or not. The bullet is a glyphicon for editing an article. If a text is editied, it is shown truncated, alterativ the title is shown.
There is an edit&translate Link at the end.

* **translate**
Same as overview, in addition it shows in one column view an edit link for every language an article is translated to.

* **final**
Comments are show with a blue/red bar, depending on you are named in a comment or not. The bullet is a glyphicon for editing an article. Text is shown complete, missing text is displayed by the collection in marked text. There is an edit&translate link at the end.

* **fullfinal**
Similar to final, No colored glyphicons, no coloured commentsmarks. Edit&translate Link at the end (if the article is incomplete) or an small "..." to edit the article at the end. The goal of fullfinal is to have a close to the product view on the article.

You can choose a language to display a blog.

Just use the dropdown in the upper right corner of OSMBC, with these dropdowns you are although able to switch the languages in the artcile view.

### Which markdown can be used

OSMBC is using markdown-it as library for generating markdown. This library is used in dillinger.io. You can find the feature list [here](https://markdown-it.github.io/). For now, no plugins are installed.

### Exporting WN / blog

Go to the Blog to export (via the blog navbar item, or the home page). The **view preview** and the **view previewEN** lead to the export page.

### Blog Status

A blog can be open, edit, review for Lang, closed and trash. Only open and review blogs are available for edit.
* **open** The blog is fully editable, collected articles are put by default to the smallest number of open blogs. This status is synchron for all languages.
* **edit** The blog is fully editable, collected articles can be put manually to this blog. This Status is synchron for all languages and is extended by:
* **review LANG** The review status can be set by language. It should be set, when the blog is exported (e.g. to WordPress) and allowes the review do add a review text to the blog. The Review text can't be changed or deleted. Blogs in Review mode can't be changed in the language, they are in review mode.
* **close LANG** The review status signals, that the review is closed, and the LANG team has switched to the next WN. Blogs in close mode for a language can't be changed in that language.
* **closed** This is a synchron status, that can be set, when all blogs are closed. You can use [this](#{layout.htmlroot}/blog/list?status=edit) to see the not synchron status and close the blog.

Additional on the blog page there is an editor for the blog name, and the categories of the blog.
This editor will be improved in future. If you rename a blog, the article become orphan and can be found with the article nav bar item.

### Pictures with OSMBC

OSMBC is supporting pictures. There are two steps of "Picture Management".

* First collect any picture link in OSMBC with the category Pictures. Use no translation, if the picture is not of interest in your language. A picture markdown looks like:

* Second create the markdown in the language you need 
```
![ALT TEXT](http://Link to picture)
Some Comment to the picture (e.g. CC-By...) and a reference to the article [^[1]^](#WN???_Article Title).
```

So if you would like to have a in page link to an article, you can do that by a #BlogName_ArticleTitle reference. the ^[1]^ just shows a superscript [1]. Do not forget to place the [1] in the referenced article.


### User Management

Every OSMBC User can add users and change properties of every user. To allow an OSM User access to OSM,
he need full access and the OSM Username must be exactly used in OSMBC.
