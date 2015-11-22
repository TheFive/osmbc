var should = require('should');
var settingsModule = require('../model/settings.js');


describe('model/settings', function() {
  it('should deliver some configurations',function(){
     var c =settingsModule.getSettings("overviewDE(EN)");
     should(c).eql({overview:true,glyphicon:true,edit:true,comment:true,editLink:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
     var c =settingsModule.getSettings("fullES");
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"ES",right_lang:"--",smallPicture:true});
     var c =settingsModule.getSettings("fullfinalEN.ES");
  })
  it('should give a standard result',function(){
     var undef;
     var c =settingsModule.getSettings(undef);
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
     var c =settingsModule.getSettings('');
     should(c).eql({glyphicon:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
  })
  it('should give a standard result for wrong langauges',function(){
     var c =settingsModule.getSettings("overviewEK.EL");
     should(c).eql({overview:true,glyphicon:true,edit:true,comment:true,editLink:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
  })
})
