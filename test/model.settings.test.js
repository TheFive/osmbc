var should = require('should');
var settingsModule = require('../model/settings.js');


describe('model/settings', function() {
  it('should deliver some configurations',function(){
     var c =settingsModule.getSettings("overviewDE(EN)");
     should(c).eql({overview:true,glyphicon:true,edit:true,comment:true,editLink:true,left_lang:"DE",right_lang:"EN"});
     var c =settingsModule.getSettings("fullES");
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"ES",right_lang:"--"});
     var c =settingsModule.getSettings("fullfinalEN.ES");
     should(c).eql({editLink:true,shortEditLink:true,,edit:true,left_lang:"EN",right_lang:"ES",bilingual:true});
  })
  it('should give a standard result',function(){
     var undef;
     var c =settingsModule.getSettings(undef);
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN"});
     var c =settingsModule.getSettings('');
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN"});
  })
  it('should give a standard result for wrong langauges',function(){
     var c =settingsModule.getSettings("overviewEK.EL");
     should(c).eql({overview:true,glyphicon:true,edit:true,comment:true,editLink:true,left_lang:"DE",right_lang:"EN"});
  })
})
