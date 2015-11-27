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
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
     
      delete result.startDate
      should(result).deepEqual({type:"social",
                                
                                desc:"[[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]]",
                               
                                country:"Germany"
                              })
    })
    it('should return values for entry with comma separated town',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || [[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]],  [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                              
                                desc:"[[Düsseldorf/Stammtisch|Stammtisch Düsseldorf]]",
                                town:"Düsseldorf",
                                country:"Germany"
                              })
    })
    it('should return values for entry with town (no comma)',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || Stammtisch  [[Düsseldorf]]  [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                               
                                desc:"Stammtisch",
                                town:"Düsseldorf",
                                country:"Germany"
                              })
    })
    it('should return values for entry with town (comma)',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || Stammtisch , [[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
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
                                country:"Germany"
                              })
    })
    it('should return values for entry with town and external description',function() {
      var result = parseEvent.parseLine("|- {{cal|social}} || {{dm|Nov 25}} || [https://www.link.de/sublink Tolle Veranstaltung]  ,[[Düsseldorf]] , [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"social",
                              
                                desc:"[https://www.link.de/sublink Tolle Veranstaltung]",
                                town:"Düsseldorf",
                                country:"Germany"
                              })
    })
    // 
    it('should return values for entry with more complex description',function() {
      var result = parseEvent.parseLine("|- {{cal|conference}} || {{dm|Aug 24|Aug 26}} || <big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>, [[Bonn]], [[Germany]] {{SmallFlag|Germany}}");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"conference",
                                
                                desc:"<big>'''[http://2016.foss4g.org/ FOSS4G 2016]'''</big>",
                                town:"Bonn",
                                country:"Germany"
                              })
    })
  
    it('should return values for entry with no town and country',function() {
      var result = parseEvent.parseLine("| {{cal|info}} || {{dm|Dec 5}} || [[Foundation/AGM15|Foundation Annual General Meeting]] on [[IRC]]");
      should.exist(result);
      delete result.startDate;
      delete result.endDate;
      should(result).deepEqual({type:"info",
                                desc:"[[Foundation/AGM15|Foundation Annual General Meeting]] on [[IRC]]"
                              })
    })
  })
})
