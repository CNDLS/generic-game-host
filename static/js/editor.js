if (!RedactorPlugins) var RedactorPlugins = {};

$.Redactor.prototype.classButton = function () {
  return {
    init: function() {
      // remember, button is the name of the API scope we're using.
      var element = this.button.add('class-button', 'Class Button');
      this.button.addCallback(element, this.classButton.click);
    },
    click: function() {
      console.log('class_button clicked');
    }
  };
};

var wysiwyg_editor;
$(function () {
  wysiwyg_editor = $('#redactor').redactor({
    focus: true,
    visual: false,
    codemirror: true,
    paragraphize: false,
    buttons: ['indent', 'outdent'],
    plugins: ['textexpander', 'classButton'],
    textexpander: [
      ['obj', "{" + $.render("p").html + "}"],
      ['arr', "[" + $.render("p").html + "]"]
    ]
  }).data("redactor");
  
  // init codemirror after redactor's call
  my_code_mirror = CodeMirror.fromTextArea($("#redactor")[0], {
    lineNumbers: true,
    mode: 'yaml'
  });

  var read_url = $("script#reader").attr("read-from");
  var parsed_yaml;
  // get the YAML from our URL.
  $.ajax({
    url: read_url,
    type: "GET",
    success: function (data /* , textStatus, XMLHttpRequest */) {
      // try to parse the game data.
      in_production_try(this,
        function () {
          // try to make a game from the parsed game data.
          debugger;
          wysiwyg_editor.code.set(data)
        }
      );
    }
  });
});