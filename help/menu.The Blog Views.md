# The Different Blog Views

|Name        | Text Shown|Show Comment| View Link | Edit Link               | Marked Text          |Translate Links |Display Picture   |
|------------|-----------|------------|-----------|-------------------------|----------------------|----------------|------------------|
|overview    | Title     |Yes         | View      | Create,Edit,Translate   | For Right Text Empty | No             | Small            |
|translate   | Title     |Yes         | Eyes Icon | Create, Edit, Translate | No                   | Per Language   | No(?)            |
|full        | Text      |Yes         | Eyes Icon | Edit Icon               | For Right Text Empty | No             | Small            |
|fullFinal   | Text      |No          | No        | ...                     | No                   | No             | Full             |


## Overview

Overview is intended to have a compact view on a blog. It does not display the blog text, but only the Title. 
If it is bilingual, the main column is the left one. Non closed comments are shown with a line at the left of the text.

You can go to the article editor with the "View" Hyperlink. With (Create / Edit / Translate) you go direct to the edit mode of the article.
* Create stands for the main markdown text is not written
* Translate stands for the left markdown text is not written
* Edit is the abbrevation for both text are already written and needs a change

Empy markdown of the main column is although in marked style.

Picture is shown in small.

## Translate

The translate view is similar to the overview.

Its main feature is, that in one column mode, it show all languages an article is already written in.

## Full

The full view is for editors, that like the complete text. Edit and View links are shown as Icon. Non closed comments are although shown.

## fullFinal

Fullfinal is intended to support review in OSMBC. There is no "Schnick Schnack", just the text, the picture and a very small edit link,
that direct opens the article editor, so that you can quickly fix any error.

It is not recommended to use this view in bilingual mode.

## The languages

Every blog view can be extended by the languages. There are three types

### LL

This is a one column blogview, that opens a one column article editor, both in the language LL.

### LL(RR)

This is a one column blogview, but it opens a bilingual article editor. The Blog is in the language LL, the article editor has the languages LL and RR.

### LL.RR

This is a bilingual blog view, that opens the same bilingual article editor.


