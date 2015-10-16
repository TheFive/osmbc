## Version 0.2.15
* User Token is now 1 year valid.
* Error message 'No Access' extended with OSM User Name.
* Bug Fix in routing in user module.

## Version 0.2.16
* id for 'h2' tag in blog export is extended by blogname

## Version 0.2.19

### Changes for Editors
* type a '-' in the english markdown replaces it by "english only"
* introduce uncategorized articles

## Version 0.2.20

### Changes for Editors
* There is a link from the user list and the user page to the OSM User

## Version 0.2.21

### minor fixes
* Changed actual -> recent

### Changes for Programmers
* If a value of a search object starts with '!=' not equal is used in the query 

### Changes for Editors
* New Menu: Who is Online, display Users sorted by last login.

## Version 0.2.21a

### Changes for Editors
* Special Search is now defined for smallest open and smalles review blog

## Version 0.2.21b

### Minor Fixes
* Blog Reference of an artikel is now not changed to Future, if blog is not open.

### Changes for Editors
* OSMBC now returns to the calling page after editing an article

## Version 0.2.22

### Minor Fixes
* removed some unnecessary console.log messages.

### Changes for Programmers
* Fixed some broke tests, by adding session object to tests, which needs a session object.

### Changes for Editors
* Introduces Help Module 
  Help Module allows editors to write a "Help Blog" and put it to the Help Menubar

## Version 0.2.23 (Under Development)

### Minor Fixes
* Skipped leading Blank in Preview Mode

### Changes for Programmers
* Improved Install Guide
* Fixed Package.json

### Changes for Editors
* It is now possible to put Articles to Help Blogs
* Skipped the generation of the Blog title in preview 
  (https://github.com/TheFive/osmbc/issues/54)
* Used the japanese flag with small frame for generation. (Issue #52)
