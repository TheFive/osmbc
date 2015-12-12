var should  = require('should');
var sinon   = require('sinon');
var async   = require('async');
var config  = require('../config.js');

var helpRoutes = require('../routes/help.js');

var testutil = require('./testutil.js');

describe('routes/help',function(){
  describe('generateHelpText',function(){
    it('should render the text with token',function(){
      var result = helpRoutes.getText('../test/data/helptext.test.md');
      should(result).equal('<h2>This Is a Help Test</h2>\n<p>Use a <a href="/testlink">link</a> to test tokens.</p>\n');
    })
  })
})


 