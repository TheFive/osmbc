"use strict";

var should = require('should');
var async  = require('async');
var testutil = require('./testutil.js');
var logModule = require('../model/logModule.js');



describe('model/changes',function() {
  context('Change Constructor',function(){
    it('should create a Change object',function(){
      var change = logModule.create({oid:"Test"});
      should(change.oid).eql("Test");
      should(typeof(change)).eql('object');
      should(change instanceof logModule.Class).be.True();
    });
  });
  context('find',function() {
    beforeEach(function (bddone) {
      testutil.clearDB(bddone);
    });
    it('should find nothing',function (bddone) {
      logModule.find({table:"usert",oid:1},{column:"oid"},function(err,result){
        should.not.exist(err);
        should(result).eql([]);
        bddone();
      });
    });
  });
  context('countLogsForBlog',function(){
    beforeEach(function(bddone){
      testutil.clearDB(bddone);
    });
    it('should count the different logs',function(bddone){
      async.parallel([
        function writeLog1(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb);},
        function writeLog2(cb){logModule.log({user:"Test1",blog:"Test",property:"field1"},cb);},
        function writeLog3(cb){logModule.log({user:"Test2",blog:"Test",property:"field2"},cb);},
        function writeLog4(cb){logModule.log({user:"Test2",blog:"Test",property:"field3"},cb);},
        function writeLog5(cb){logModule.log({user:"Test2",blog:"Test",property:"field4"},cb);},
        function writeLog6(cb){logModule.log({user:"Test2",blog:"OtherTest",property:"field1"},cb);}

      ],function(err){
        should.not.exist(err);
        logModule.countLogsForBlog("Test",function(err,result){
          should.not.exist(err);
          should(result).eql({"field1":{"Test1":2},"field2":{"Test2":1},"field3":{"Test2":1},"field4":{"Test2":1}});
          bddone();
        });
      });
    });
  });
  context('htmlDiffText',function() {
    it('should generate a colored word based diff',function(){
      var change = new logModule.Class({from:"This is The origin text",to:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And </span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">The</span>\n<span class="osmbc-inserted">the</span>\n<span style="color:grey">…</span>\n<span class="osmbc-deleted">origin</span>\n<span class="osmbc-inserted">changed</span>\n<span style="color:grey">…</span>\n');
    });
    it('should handle emptry from',function(){
      var change = new logModule.Class({to:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">And This is the changed text</span>\n');
    });
    it('should handle emptry to',function(){
      var change = new logModule.Class({from:"And This is the changed text"});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-deleted">And This is the changed text</span>\n');
    });
    it('should handle bool Value',function(){
      var change = new logModule.Class({to:true});
      should(change.htmlDiffText(40)).equal('<span class="osmbc-inserted">true</span>\n');
    });
    it('should find out only inserted spaces',function(){
      var change = new logModule.Class({from:"This is The origin text with [markup](www.google.de)",to:"This is The origin text with [markup] (www.go ogle.de)"});
      should(change.htmlDiffText(40)).eql('<span class="osmbc-inserted">ONLY SPACES ADDED</span>');
    });
    it('should find out only deleted spaces',function(){
      var change = new logModule.Class({to:"This is The origin text with [markup](www.google.de)",from:"This is The origin text with [markup] (www.go ogle.de)"});
      should(change.htmlDiffText(40)).eql('<span class="osmbc-deleted">Only spaces removed</span>');
    });
    it('should find handle long texts',function(){
      var change = new logModule.Class({to:"|Wo                    |Was
      |Wann                 |Land                                                                     |\r\n|----------------
        ------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
        -------------------------------------------------------------------|---------------------|-------------------------------------------------------------------------|\r\n|Budapest              |[OpenStreetM
        ap Budapest Meetup](http://www.meetup.com/OpenStreetMap-OSGeo-Hungary/events/228583865/)
      |15.02.2016           |![hungary](http://blog.openstreetmap.de/wp-uploads//2016/02/hu.svg)      |\r\n|Riohacha              |[Mapathon por la Guajira](http:
//blog.openstreetmap.co/2016/01/19/agenda-guajira/)
      |16.02.2016-26.02.2016|![colombia](http://blog.openstreetmap.de/wp-uploads//2016/02/co.svg)     |\r\n|Derby                 |[Derby](https://wiki.openstreetmap.org/wiki/Nottin
      gham/Pub%20Meetup)
      |16.02.2016           |![england](http://blog.openstreetmap.de/wp-uploads//2015/01/en.svg)      |\r\n|Bonn                  |[Bonner Stammtisch](https://wiki.openstreetmap.org/wiki/Bonn/Stammtis
      ch)                                                                                                                                                                                                |16.02.20
      16           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Grasse                |[http://www.asso-choisir.org/balade-urbaine-et-carto-party-a-grasse/ Balade urbaine et c
      artopartie à Grasse](https://wiki.openstreetmap.org/wiki/http://www.asso-choisir.org/balade-urbaine-et-carto-party-a-grasse/%20Balade%20urbaine%20et%20cartopartie%20à%20Grasse)|16.02.2016           |![fra
      nce](http://blog.openstreetmap.de/wp-uploads//2016/02/fr.svg)       |\r\n|Lüneburg              |[Mappertreffen Lüneburg](https://wiki.openstreetmap.org/wiki/Lüneburg/Mappertreffen)
      |16.02.2016           |![germany](http://blog.o
      penstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Karlsruhe             |[Stammtisch](https://wiki.openstreetmap.org/wiki/Karlsruhe#Nächstes%20Treffen)
      |17.02.2016           |![germany](http://blog.openstreetmap.de/wp-
      uploads//2016/01/de.svg)      |\r\n|Augsburg              |[Augsburg Stammtisch](https://wiki.openstreetmap.org/wiki/Augsburg/Stammtisch)
      |18.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de
      .svg)      |\r\n|                      |[Stammtisch Freiberg](https://wiki.openstreetmap.org/wiki/Stammtisch_Freiberg#N.C3.A4chster_Termin)
      |18.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Se
      attle               |[Missing Maps Mapathon](http://www.meetup.com/OpenStreetMap-Seattle/events/228654886/)
      |20.02.2016           |![us](http://blog.openstreetmap.de/wp-uploads//2016/01/us.svg)           |\r\n|Bremen
      |[Bremer Mappertreffen](https://wiki.openstreetmap.org/wiki/Bremen/Veranstaltungen)
      |22.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Graz                  |[Stammtisch](http
      s://wiki.openstreetmap.org/wiki/Graz/Stammtisch)
        |22.02.2016           |![austria](http://blog.openstreetmap.de/wp-uploads//2016/02/at.svg)      |\r\n|Taipei                |OpenStreetMap Taipei Meetup

      |22.02.2016           |![taiwan](http://blog.openstreetmap.de/wp-uploads//2016/01/tw.svg)       |\r\n|Viersen               |[OSM Stammtisch Viersen](https://wiki.openstreetmap.org
      /wiki/Niederrhein/Viersen/Stammtisch)
      |23.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Urspring              |[Stammtisch Ulmer Alb](https://wiki.openstreetmap.org/wiki/UlmerAlb)
      |23.02.2016
      |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Düsseldorf            |[Stammtisch](https://wiki.openstreetmap.org/wiki/Düsseldorf/Stammtisch)
      |24.02.2016           |![germany]
      (http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Colorado              |[Humanitarian Mapathon](http://www.meetup.com/OSM-Colorado/events/228614237/) [Colorado State University](http:/
      /www.colostate.edu/), [Fort Collins](https://wiki.openstreetmap.org/wiki/Fort%20Collins,%20Colorado)                                                    |24.02.2016           |![us](http://blog.openstreetm
      ap.de/wp-uploads//2016/01/us.svg)           |\r\n|                      |[Université Quisqueya](http://uniq.edu.ht/) [Port-au-Prince](https://wiki.openstreetmap.org/wiki/Port-au-Prince)
      |24.02.2016           |![haiti](http://blog.openstreetmap.de/wp-uploads
//2016/02/ht.svg)        |\r\n|Colorado              |[Humanitarian Mapathon](http://www.meetup.com/OSM-Colorado/events/228614359/) [University of Northern Colorado](http://www.unco.edu/), [Greeley](https
      ://wiki.openstreetmap.org/wiki/Greeley,%20Colorado)                                                               |25.02.2016           |![us](http://blog.openstreetmap.de/wp-uploads//2016/01/us.svg)
      |\r\n|Cagliari              |[Wikinusa le comunità Wikipedia e OpenStreetMap si incontrano](http://sardiniaopendata.org/2016/02/17/wikinusa-a-cagliari-le-comunita-wikimedia-e-openstreetmap-si-incont
      rano/)                                                                                         |25.02.2016           |![italy](http://blog.openstreetmap.de/wp-uploads//2016/01/it.svg)        |\r\n|Toluca
      |[Primeras Jornadas de Mapas Libres](https://twitter.com/OpenStreetMapMX/status/695395692995457025)
      |26.02.2016-27.02.2016|![mexico](http://blog.openstreetmap.de/wp-uploads//2016/02/mx.svg)       |\r\n|Lyon                  |[Sa
      lon Primevère](https://www.google.com/url?q=http%3A%2F%2Fsalonprimevere.org%2Fsalon_exposants_openstreetmap-france&usd=2&usg=AFQjCNFbKfXb9NNr_HQhLYzD_718cNaL-w)
      |26.02.2016-28.02.2016|![france](http://blog.openstreetmap.de/wp-uploads//2016/02/fr.svg)       |\r\n|Karlsruhe             |[Hack Weekend](https:/
      /wiki.openstreetmap.org/wiki/Karlsruhe%20Hack%20Weekend%20February%202016)
      |27.02.2016-28.02.2016|![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Castries              |[MapSaintLucia 2016](http://www.mapsaintl
      ucia.org/) [Castries](http://www.openstreetmap.org/?mlat=14.0087&mlon=-60.9909#map=15/14.0088/-60.9909)
      |28.02.2016           |![saint lucia](http://blog.openstreetmap.de/wp-uploads//2016/02/lc.svg)  |",from:"This is The origin text with [markup] (www.go ogle.de)"});
      should(change.htmlDiffText(40)).eql('<span class="osmbc-deleted">Only spaces removed</span>');
    });
  });
});

|Wo                    |Was
|Wann                 |Land                                                                     |\r\n|----------------
  ------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  -------------------------------------------------------------------|---------------------|-------------------------------------------------------------------------|\r\n|Budapest              |[OpenStreetM
  ap Budapest Meetup](http://www.meetup.com/OpenStreetMap-OSGeo-Hungary/events/228583865/)
|15.02.2016           |![hungary](http://blog.openstreetmap.de/wp-uploads//2016/02/hu.svg)      |\r\n|Riohacha              |[Mapathon por la Guajira](http:
//blog.openstreetmap.co/2016/01/19/agenda-guajira/)
|16.02.2016-26.02.2016|![colombia](http://blog.openstreetmap.de/wp-uploads//2016/02/co.svg)     |\r\n|Derby                 |[Derby](https://wiki.openstreetmap.org/wiki/Nottin
gham/Pub%20Meetup)
|16.02.2016           |![england](http://blog.openstreetmap.de/wp-uploads//2015/01/en.svg)      |\r\n|Bonn                  |[Bonner Stammtisch](https://wiki.openstreetmap.org/wiki/Bonn/Stammtis
ch)                                                                                                                                                                                                |16.02.20
16           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Grasse                |[http://www.asso-choisir.org/balade-urbaine-et-carto-party-a-grasse/ Balade urbaine et c
artopartie à Grasse](https://wiki.openstreetmap.org/wiki/http://www.asso-choisir.org/balade-urbaine-et-carto-party-a-grasse/%20Balade%20urbaine%20et%20cartopartie%20à%20Grasse)|16.02.2016           |![fra
nce](http://blog.openstreetmap.de/wp-uploads//2016/02/fr.svg)       |\r\n|Lüneburg              |[Mappertreffen Lüneburg](https://wiki.openstreetmap.org/wiki/Lüneburg/Mappertreffen)
|16.02.2016           |![germany](http://blog.o
penstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Karlsruhe             |[Stammtisch](https://wiki.openstreetmap.org/wiki/Karlsruhe#Nächstes%20Treffen)
|17.02.2016           |![germany](http://blog.openstreetmap.de/wp-
uploads//2016/01/de.svg)      |\r\n|Augsburg              |[Augsburg Stammtisch](https://wiki.openstreetmap.org/wiki/Augsburg/Stammtisch)
|18.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de
.svg)      |\r\n|                      |[Stammtisch Freiberg](https://wiki.openstreetmap.org/wiki/Stammtisch_Freiberg#N.C3.A4chster_Termin)
|18.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Se
attle               |[Missing Maps Mapathon](http://www.meetup.com/OpenStreetMap-Seattle/events/228654886/)
|20.02.2016           |![us](http://blog.openstreetmap.de/wp-uploads//2016/01/us.svg)           |\r\n|Bremen
|[Bremer Mappertreffen](https://wiki.openstreetmap.org/wiki/Bremen/Veranstaltungen)
|22.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Graz                  |[Stammtisch](http
s://wiki.openstreetmap.org/wiki/Graz/Stammtisch)
  |22.02.2016           |![austria](http://blog.openstreetmap.de/wp-uploads//2016/02/at.svg)      |\r\n|Taipei                |OpenStreetMap Taipei Meetup

|22.02.2016           |![taiwan](http://blog.openstreetmap.de/wp-uploads//2016/01/tw.svg)       |\r\n|Viersen               |[OSM Stammtisch Viersen](https://wiki.openstreetmap.org
/wiki/Niederrhein/Viersen/Stammtisch)
|23.02.2016           |![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Urspring              |[Stammtisch Ulmer Alb](https://wiki.openstreetmap.org/wiki/UlmerAlb)
|23.02.2016
|![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Düsseldorf            |[Stammtisch](https://wiki.openstreetmap.org/wiki/Düsseldorf/Stammtisch)
|24.02.2016           |![germany]
(http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Colorado              |[Humanitarian Mapathon](http://www.meetup.com/OSM-Colorado/events/228614237/) [Colorado State University](http:/
/www.colostate.edu/), [Fort Collins](https://wiki.openstreetmap.org/wiki/Fort%20Collins,%20Colorado)                                                    |24.02.2016           |![us](http://blog.openstreetm
ap.de/wp-uploads//2016/01/us.svg)           |\r\n|                      |[Université Quisqueya](http://uniq.edu.ht/) [Port-au-Prince](https://wiki.openstreetmap.org/wiki/Port-au-Prince)
|24.02.2016           |![haiti](http://blog.openstreetmap.de/wp-uploads
//2016/02/ht.svg)        |\r\n|Colorado              |[Humanitarian Mapathon](http://www.meetup.com/OSM-Colorado/events/228614359/) [University of Northern Colorado](http://www.unco.edu/), [Greeley](https
://wiki.openstreetmap.org/wiki/Greeley,%20Colorado)                                                               |25.02.2016           |![us](http://blog.openstreetmap.de/wp-uploads//2016/01/us.svg)
|\r\n|Cagliari              |[Wikinusa le comunità Wikipedia e OpenStreetMap si incontrano](http://sardiniaopendata.org/2016/02/17/wikinusa-a-cagliari-le-comunita-wikimedia-e-openstreetmap-si-incont
rano/)                                                                                         |25.02.2016           |![italy](http://blog.openstreetmap.de/wp-uploads//2016/01/it.svg)        |\r\n|Toluca
|[Primeras Jornadas de Mapas Libres](https://twitter.com/OpenStreetMapMX/status/695395692995457025)
|26.02.2016-27.02.2016|![mexico](http://blog.openstreetmap.de/wp-uploads//2016/02/mx.svg)       |\r\n|Lyon                  |[Sa
lon Primevère](https://www.google.com/url?q=http%3A%2F%2Fsalonprimevere.org%2Fsalon_exposants_openstreetmap-france&usd=2&usg=AFQjCNFbKfXb9NNr_HQhLYzD_718cNaL-w)
|26.02.2016-28.02.2016|![france](http://blog.openstreetmap.de/wp-uploads//2016/02/fr.svg)       |\r\n|Karlsruhe             |[Hack Weekend](https:/
/wiki.openstreetmap.org/wiki/Karlsruhe%20Hack%20Weekend%20February%202016)
|27.02.2016-28.02.2016|![germany](http://blog.openstreetmap.de/wp-uploads//2016/01/de.svg)      |\r\n|Castries              |[MapSaintLucia 2016](http://www.mapsaintl
ucia.org/) [Castries](http://www.openstreetmap.org/?mlat=14.0087&mlon=-60.9909#map=15/14.0088/-60.9909)
|28.02.2016           |![saint lucia](http://blog.openstreetmap.de/wp-uploads//2016/02/lc.svg)  |