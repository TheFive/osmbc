# How To Notify about Changes via Slack

## Principle

OSMBC can inform users about changes via EMail, but that results in one email per change, and can be an information overflow.

Slack offers a tracking of new messages in a channel, and so OSMBC can write all new Information to a slack channel,
to use the Slack Notification Mechanisms for new information.

On the other hand, there are process relevant messages, like reviews, that should be
placed into the relevant channels, where the editors are discussing their blog, they are working on.
So all EN Relevant Reviews has to be put into the english Slack channel, and all DE Stuff
will have to go to the DE Channel.

To support this, several channels with different filters can be configured in OSMBC.

## Configuration of Slack Channel

In the admin view you can go to the admin "Configuration of Slack Channel" view.. This opens
a YAML configuration, with all channels.

Every Slack Channel to be supported can be entered with a separate configuration.

Start a new Slack Channel with a -.

The Format is as follows

```
- slack: SLACK
  channel: "#osmbcarticle"
  notifyNewCollection: true
  notifyAllComment: true
  notifyComment: []
  notifyBlogStatusChange: false
  notifyBlogLanguageStatusChange: []
```

* Use osmde or theweeklyosm (lower letter) for the supported slacks.
* Channel is the slack channel, starting with the #.
* notifyNewCollection: true or false, send a notification for every new article
* notifyAllComment: true or false, send a notification for all comments
* notifyComment: an array (e.g.: ["DE","EN"]), to indicate a language / user mentioned in a comment to select.
* notifyBlogStatusChange: true or false, notification on change of a blog to EDIT or close
* notifyBlogLanguageStatusChange: an array (e.g.: ["DE","EN"]), all languages, where a status change has to be notified for.
