var should = require('should');
var settingsModule = require('../model/settings.js');


describe('model/settings', function() {
  it('should deliver some configurations',function(){
     var c =settingsModule.getSettings("overviewDE(EN)");
     should(c).eql({overview:true,editLink:true,marktext:true,edit:true,comment:true,viewLink:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
     var c =settingsModule.getSettings("fullES");
     should(c).eql({glyphicon_edit:true,glyphicon_view:true,edit:true,comment:true,marktext:true,left_lang:"ES",right_lang:"--",smallPicture:true});
     var c =settingsModule.getSettings("fullfinalEN.ES");
     should(c).eql({bilingual:true,edit:true,fullfinal:true,shortEditLink:true,left_lang:"EN",right_lang:"ES",smallPicture:false});
  })
  it('should give a standard result',function(){
     var undef;
     var c =settingsModule.getSettings(undef);
     should(c).eql({glyphicon_edit:true,glyphicon_view:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
     var c =settingsModule.getSettings('');
     should(c).eql({glyphicon_edit:true,glyphicon_view:true,edit:true,comment:true,marktext:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
  })
  it('should give a standard result for wrong langauges',function(){
     var c =settingsModule.getSettings("overviewEK.EL");
     should(c).eql({overview:true,edit:true,comment:true,editLink:true,marktext:true,viewLink:true,left_lang:"DE",right_lang:"EN",smallPicture:true});
  })
  it('should return a small object for one language',function() {
     var c =settingsModule.getSettings("EN");
     should(c).eql({edit:false,fullfinal:true,left_lang:"EN",right_lang:"--"});    
  })
  it('should return a small object for two languages',function() {
     var c =settingsModule.getSettings("EN.ES");
     should(c).eql({edit:false,left_lang:"EN",right_lang:"ES"});    
  })
})
