"use strict";

var should = require('should');
var parseEvent = require('../model/parseEvent.js');
var nock = require('nock');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');


describe('model/parseEvent',function() {
  var clock;
  before(function(bddone){
    clock = sinon.useFakeTimers(new Date("2015-12-06").getTime());
    bddone();
  });
  after(function(bddone){
    clock.restore();
    bddone();
  });
  describe('nextDate',function() {
    it('should generate a date in the timeframe [now-50:now+316]',function(){
      var d = new Date();
      var timeMin = d.getTime()-1000*60*60*24*50;
      var timeMax = timeMin + 1000*60*60*24*366;
      function isInRange(date) {
        var result = ((date.getTime()>=timeMin)&& (date.getTime()<=timeMax));
        return result;
      }

      var date = parseEvent.nextDate(new Date('Jan 27'));
      should(isInRange(date)).be.True();
      should(date.getDate()).equal(27);
      should(date.getMonth()).equal(0);
      date = parseEvent.nextDate(new Date('Feb 01'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Mar 31'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('May 10'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('May 10'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Jun 15'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Jul 20'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Aug 11'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Sep 30'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Oct 2'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Nov 28'));
      should(isInRange(date)).be.True();
      date = parseEvent.nextDate(new Date('Dec 24'));
      should(isInRange(date)).be.True();
    });
  });
  describe('parseWikiInfo',function(){
    it('should parse a [[]] reference',function(){
      should(parseEvent.parseWikiInfo('  Text [[link]] another Text'))
        .equal('Text [link](https://wiki.openstreetmap.org/wiki/link) another Text');
    });
    it('should parse a [[|]] reference',function(){
      should(parseEvent.parseWikiInfo('[[link|Text for Link]]'))
        .equal('[Text for Link](https://wiki.openstreetmap.org/wiki/link)');
    });
    it('should parse a [ ] reference',function(){
      should(parseEvent.parseWikiInfo('[https://test.test/test Text for Link]'))
        .equal('[Text for Link](https://test.test/test)');
    });
    it('should parse a [] reference',function(){
      should(parseEvent.parseWikiInfo('[https://test.test/test]'))
        .equal('[https://test.test/test](https://test.test/test)');
    });
    it('should parse a complex reference [] first',function(){
      should(parseEvent.parseWikiInfo('The Event [https://test.test/test Text for Link] will be on [[irc]]'))
        .equal('The Event [Text for Link](https://test.test/test) will be on [irc](https://wiki.openstreetmap.org/wiki/irc)');
    });
    it('should parse a complex reference [[]] first',function(){
      should(parseEvent.parseWikiInfo('You find on [[irc]] the Event [https://test.test/test Text for Link]'))
        .equal('You find on [irc](https://wiki.openstreetmap.org/wiki/irc) the Event [Text for Link](https://test.test/test)');
    });


  });
  describe('parseLineEvent',function(){
    it('should return null for wrong lines',function() {
      should(parseEvent.parseLine('|-  ')).equal(null);
      should(parseEvent.parseLine('|-')).equal(null);
      should(parseEvent.parseLine('|-        ')).equal(null);
    });
    it('should return values for entry with no town',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]], [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
     
      delete result.startDate;
      should(result).deepEqual({type:"social",
                                
                                desc:"[[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]]",
                                countryflag:"Germany",
                               
                                country:"Germany"
                              });
    });
    it('should return values for entry with comma separated town',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]],  [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                              
                                desc:"[[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]]",
                                town:"Düsseldorf",
                                country:"Germany",
                                countryflag:"Germany"
                              });
    });
    it('should return values for entry with town (comma)',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Nov 25}} || Stammtisch,  [[Düsseldorf]],  [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                               
                                desc:"Stammtisch",
                                town:"Düsseldorf",
                                country:"Germany",
                                countryflag:"Germany"
                              });
    });
    it('should return values for entry with town (comma)',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Nov 25}} || Stammtisch , [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(10);
      should(result.endDate.getDate()).equal(25);
      should(result.endDate.getMonth()).equal(10);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                                desc:"Stammtisch",
                                town:"Düsseldorf",
                                country:"Germany",
                                countryflag:"Germany"
                              });
    });
    it('should return values for entry with town and external description',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Nov 25}} || [https://www.link.de/sublink Tolle Veranstaltung]  ,[[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                              
                                desc:"[https://www.link.de/sublink Tolle Veranstaltung]",
                                town:"Düsseldorf",
                                country:"Germany",
                                countryflag:"Germany"
                              });
    });
    // 
    it('should return values for entry with more complex description',function() {
      var result = parseEvent.parseLine("| {{cal|conference}} || {{dm|Aug 24|Aug 26}} || <big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>, [[Bonn]], [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"conference",
                                
                                desc:"<big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>",
                                town:"Bonn",
                                country:"Germany",
                                countryflag:"Germany"
                              });
    });
  
    it('should return values for entry with no town and country',function() {
      var result = parseEvent.parseLine("| {{cal|info}} || {{dm|Dec 5}} || [[Foundation/AGM15|Foundation Annual General Meeting]] on [[IRC]]");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"info",
                                desc:"[[Foundation/AGM15|Foundation Annual General Meeting]] on [[IRC]]"
                              });
    });
    it('should return values for entry with country and two flags',function() {
      var result = parseEvent.parseLine("| {{cal|social}} || {{dm|Dec 3}} || [[Wien/Stammtisch|53. Wiener Stammtisch]], [[Austria]] {{SmallFlag|Wien|Wien Wappen.svg}} {{SmallFlag|Austria}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                                desc:"[[Wien/Stammtisch|53. Wiener Stammtisch]]",
                                country:"Austria",
                                countryflag:"Austria",
                                wappenflag:"Wien|Wien Wappen.svg",
                              });
    });
  });
  describe('calenderToMarkdown',function(){
    before(function(){
      var fileName = path.join(__dirname,'/data/calenderData.wiki');
 
      nock('https://wiki.openstreetmap.org')
                .get('/w/api.php?action=query&titles=Template:Calendar&prop=revisions&rvprop=content&format=json')
              
                .replyWithFile(200,fileName);
    });
    it('should load date form wiki and generate a Markdown String',function(bddone){
      parseEvent.calenderToMarkdown({lang:"DE"},new Date("11/28/2015"),14,function(err,result){
        var excpeted = fs.readFileSync(path.join(__dirname,'/data/calender.markup'),"utf8");
        should(result).equal(excpeted);
         bddone();
      });
    });
  });
});
