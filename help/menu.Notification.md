# OSMBC Notifications

## Principles

In OSMBC there are some hooks implemented, that allows to send information out of OSMBC to the editors. For now these hooks are:

* a new article was written
* a comment was added/changed
* a comment was added/changed containing a defined @ADRESSEE
* a blog was set to review, a review was done, or a blog is marked as exported


## Delivery of Notifications

For now, OSMBC has only one way to deliver information:

* mail

There will be more types implemented later.

## Configuring Mail for Notification

Go to your userpage (or a userpage of an other user) and change the email field to the email adress needed.
The email is not accepted direct, but it has to be verified by the user.
For verification purposes an email is send out to the user with a link to do the verification. The verification only works if the user is logged in with his OSMBC / Openstreetmap Account.

To resend an welcome email you have to change the email string to an empty one and then back to the correct one.

## Filter you Notification

There is a simple config system in the user page, with some options for now.

* Mail All Comments
  send a mail for every comment change.
* Mail a new Collection
  send a mail for every new article.
* Mail defined comments
  Filter from all comments by language or your User Name.
* Mail Status Change
  Mail all changes regarding review status of a blog.

  
There will be more types implemented later.

