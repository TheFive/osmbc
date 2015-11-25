var should = require('should');
var testutil = require('./testutil.js');
var parseEvent = require('../model/parseEvent.js');


describe('model/parseEvent',function() {
  context('parseLineEvent',function(){
    it('should return null for wrong lines',function() {
      should(parseEvent.parseLine('|-  ')).equal(null);
      should(parseEvent.parseLine('|-')).equal(null);
      should(parseEvent.parseLine('|-        ')).equal(null);
    })
    it('should return values for entry with no town',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]], [[Germany]] {{SmallFlag|Germany}}");
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(11);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate
      should(result).deepEqual({type:"social",
                                endDate:null,
                                desc:{title:"Stammtisch Düsseldorf",link:"https://wiki.openstreetmap.org/Düsseldorf/Stammtisch"},
                                town:null,
                                country:{title:"Germany",link:"https://wiki.openstreetmap.org/Germany"}
                              })
    })
    it('should return values for entry with comma separated town',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]],  [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(11);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate
      should(result).deepEqual({type:"social",
                                endDate:null,
                                desc:{title:"Stammtisch Düsseldorf",link:"https://wiki.openstreetmap.org/Düsseldorf/Stammtisch"},
                                town:{title:"Düsseldorf"},link:"https://wiki.openstreetmap.org/Düsseldorf",
                                country:{title:"Germany",link:"https://wiki.openstreetmap.org/Germany"}
                              })
    })
    it('should return values for entry with town (no comma)',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || Stammtisch  [[Düsseldorf]]  [[Germany]] {{SmallFlag|Germany}}");
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(11);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate
      should(result).deepEqual({type:"social",
                                endDate:null,
                                desc:{title:"Stammtisch",link:null},
                                town:{title:"Düsseldorf",link:"https://wiki.openstreetmap.org/Düsseldorf"},
                                country:{title:"Germany",link:"https://wiki.openstreetmap.org/Germany"}
                              })
    })
    it.only('should return values for entry with town (comma)',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || Stammtisch , [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      console.dir(result);
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
                                endDate:null,
                                desc:{title:"Stammtisch",link:null},
                                town:"Düsseldorf",
                                country:"Germany"
                              })
    })
    it('should return values for entry with town and external description',function() {
      var result = parseEvent.parseLine("{{cal|social}} || {{dm|Nov 25}} || [https://www.link.de/sublink Tolle Veranstaltung]  ,[[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(11);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate
      should(result).deepEqual({type:"social",
                                endDate:null,
                                desc:{title:"Tolle Veranstaltung",link:"https://www.link.de/sublink"},
                                town:{title:"Düsseldorf",link:"https://wiki.openstreetmap.org/Düsseldorf"},
                                country:{title:"Germany",link:"https://wiki.openstreetmap.org/Germany"}
                              })
    })
    // 
    it('should return values for entry with more complex description',function() {
      var result = parseEvent.parseLine("| {{cal|conference}} || {{dm|Aug 24|Aug 26}} || <big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>, [[Bonn]], [[Germany]] {{SmallFlag|Germany}}");
      should(result.startDate.getDate()).equal(25);
      should(result.startDate.getMonth()).equal(11);
      var d=new Date();
      d.setDate(d.getDate()-50);
      should(result.startDate.getYear()).equal(d.getYear());
      delete result.startDate
      should(result).deepEqual({type:"social",
                                endDate:null,
                                desc:{title:"<big>'''FOSS4G 2016'''</big>",link:"http://2016.foss4g.org/"},
                                town:{title:"Bonn",link:"https://wiki.openstreetmap.org/Bonn"},
                                country:{title:"Germany",link:"https://wiki.openstreetmap.org/Germany"}
                              })
    })
  })
})
