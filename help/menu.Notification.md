# OSMBC Notifications

## Principles

In OSMBC there are some hooks implemented, that allows to send information out of OSMBC to the editors. For now these hooks are:

* a new article was written
* a comment was added/changed
* a comment was added/changed containing a defined @ADRESSEE

There will be more types implemented later.

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

* mailAllComment
  send a mail for every comment change.
* mailNewCollection
  send a mail for every new article.
* mailComment
  Here you can enter a string like DE, ES peda to filter for @DE @ES @peda in a comment.

There will be more types implemented later.

