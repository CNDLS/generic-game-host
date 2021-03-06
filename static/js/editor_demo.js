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
          parsed_yaml = new YAML( jsyaml.safeLoad(data, { schema: GAME_SCHEMA }) );
        }
      );
      // render parsed_yaml as nested lists.
      if (parsed_yaml) { 
        renderYAML(parsed_yaml);
        
        // highlight.
        $("#schema li").click(function (evt) {
            activateTarget(evt.target);
            evt.stopPropagation();
        });
        $("#schema li").hover(
          function (evt) {
            $("#schema li").css("border-color", "transparent");
            $(this).css("border-color", "#eee");
            evt.stopPropagation();
          },
          function (evt) {
            $(this).css("border-color", "transparent");
            evt.stopPropagation();
          }
        );
        // clear.
        $("#schema").click(function (evt) {
            $("#schema *").attr("state", null);
            $(".redactor-box").css({ display: "none" });
            evt.stopPropagation();
            evt.stopImmediatePropagation();
        });
        // add elements or members.
        $("#schema ul[type=object]").click(function (evt) {
            if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
              var obj_tag = $(this);
              obj_tag.toggleClass("closed");
              if (obj_tag.hasClass("closed")) {
                var classname = obj_tag.attr("game_class");
                if (classname) {
                  obj_tag.render({ "span": " " + classname });
                } else {
                  // if array element, use array's classname.
                  var ul_parent = obj_tag.parents("ul").first();
                  if (ul_parent.attr("type") === "array") {
                    classname = ul_parent.attr("game_class");
                    if (classname) {
                      obj_tag.render({ "span": " " + classname });
                    }
                  }
                }
              } else {
                obj_tag.children("span").remove();
              }
            }  if (isOnAddCntl(evt)) {
              console.log("add member to object")
            }
            evt.stopPropagation();
        });
        $("#schema ul[type=array]").click(function (evt) {
            if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
              // $(this).toggleClass("closed");
              var array_tag = $(this);
              array_tag.toggleClass("closed");
              if (array_tag.hasClass("closed")) {
                var items = $(evt.target).children("li");
                array_tag.render({ "span": " [" + items.length + "]" });
              } else {
                array_tag.children("span").remove();
              }
            } else if (isOnAddCntl(evt)) {
              var new_li = $("<li/>").appendTo(this);
              activateTarget(new_li.get(0));
            }
            evt.stopPropagation();
        });
        
        $("#schema ul[type=function]").click(function (evt) {
            if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
              var fn_tag = $(this);
              fn_tag.toggleClass("closed");
              if (fn_tag.hasClass("closed")) {
                var params = $(evt.target).find(".params > ul[type=array]").eq(0).children("li");
                params = $(params).collect(function () {
                  return this.childNodes[0].nodeValue || "?";
                }).join(", ")
                var fn_signature = " (" + params + ")";
                $(evt.target).render({ "span": fn_signature });
              } else {
                $(evt.target).children("span").remove();
              }
            }
            evt.stopPropagation();
        });
        
        // initialize functions in closed state.
        $("#schema ul[type=function]").each(function () {
          var params = $(this).find(".params > ul[type=array]").eq(0).children("li");
          params = $(params).collect(function () {
            return this.childNodes[0].nodeValue || "?";
          }).join(", ")
          var fn_signature = " (" + params + ")";
          $(this).render({ "span": fn_signature });
        });

        // delete key.
        $(document.body).keydown(function (evt) {
            if ($(evt.target).parents(".redactor-box").length){ return; }
            if (evt.keyCode === 8) {
                var active_element = $("[state=active]");
                if (!active_element.is(":empty")) {
                  var label = active_element.attr("class");
                  if ( (active_element[0].childNodes.length === 1) 
                    && (active_element[0].childNodes[0].nodeType === 3) ) {
                    label += " '" + active_element[0].childNodes[0].nodeValue + "'";
                  }
                  
                  if (window.confirm("Are you sure you want to delete " + label + "?")) {
                    active_element.remove();
                    $(".redactor-box").css({ display: "none" });
                  }
                }

                evt.stopPropagation();
                evt.stopImmediatePropagation();
                return false;
            }
        });
      }
    },
    error: function (XMLHttpRequest, textStatus, errorThrown) {
      console.error(XMLHttpRequest, textStatus, errorThrown);
    }
  });
});


function activateTarget (evt_target) {
  $("#schema *").attr("state", null);
  $(evt_target).attr("state", "active");
  // line up the editor.
  if (evt_target.nodeName === "LI") {
      $(".redactor-box").css({ display: "block" });
      $(".redactor-box").offset({ top: $(evt_target).offset().top });
      var contexts = $(evt_target).parents("ul").addBack();
      var game_class = contexts.collect(function () {
        return $(this).attr("game_class");
      });
      game_class = $.grep(game_class, function (gc) {
        return (gc);
      }).pop();

      var class_button = wysiwyg_editor.$toolbar.find("a[rel=class-button]");

      if (game_class) {
        class_button.html(game_class);
        wysiwyg_editor.$toolbar.find(".redactor-button-disabled").removeClass("redactor-button-disabled");
        wysiwyg_editor.selection.selectAll();
        var spec = $(evt_target).parents().addBack().any(function () {
            return $(this).data("spec");
        });
        var yaml_spec = 
        jsyaml.dump(spec)
        .replace(/\"\d+\"\:/g, "-")
        .replace(/\"(.+(\"\:\s\")?.+)\"/g, '$1')
        .replace(/\"\:\s\"/, ' > ');
        wysiwyg_editor.code.set("--- # " + game_class + " object edited by " + username + " on " + Date().replace(/\sGMT-\d{4}/, "") + "\n" + yaml_spec);
        
      } else {
        // wysiwyg_editor.text(" ");
      }
      // console.log($(evt_target), $(evt_target).data("yaml"), jsyaml.dump($(evt_target).data("yaml")))
      // my_code_mirror.setValue(jsyaml.dump($(evt_target).data("yaml") || ""));
  }
}

function isOnArrow (evt) {
  return (
      (evt.offsetX <= 25) &&
      (evt.offsetX >= 5) &&
      (evt.offsetY <= 25) &&
      (evt.offsetY >= 5)
     );
}
function isOnAddCntl (evt) {
  return (
      (evt.offsetX <= 60) &&
      (evt.offsetX >= 20) &&
      (evt.offsetY <= $(evt.target).height() + 4 &&
      (evt.offsetY >= $(evt.target).height() - 16))
     );
}

function getAssociatedClass (context, test_classname) {
  try {
    if (/^[A-Z]/.test(test_classname[0]) === false) {
      test_classname = test_classname.classify();
    }
      return eval(context + "['" + test_classname + "']");
  } catch (e) { 
    // console.log(e)
  }
}

function scopeName (context, test_classname) {
  try{
    var scope = eval(context + "['" + test_classname.singularize().camelize() + "']");
    if (scope) {
      return context + "." + test_classname.singularize().camelize();
    }
  } catch (e) {}
}

function is_html_spec (obj) {
	var tag_id_class_regexp = /^(\w+)?(#\w[^\.\[]+)?((?:\.\w[^\[]+)*)?(\[\S+=\S+\])*$/;
  var is_a_spec = true;
  try {
    for (var m in obj) {
      is_a_spec = is_a_spec && tag_id_class_regexp.test(m) && tag_id_class_regexp.test(obj[m]);
      if (m === "variable_name") is_a_spec = false;
    }
  } catch (e) {
    is_a_spec = false;
  }

  return is_a_spec;
}

function renderYAML (yaml, container, context, current_scope) {
	
    // init parsed_yaml_as_html as game, if nec.
    if (!container) {
        container = $("#schema");
        container.render({'h3': "&quot;" + yaml.get("Title") + "&quot;"});
        container.render('ul[type=object][game_class=Game]');
        container = container.find('ul[type=object]');
        context = "Game";
    }

    current_scope = current_scope || game; // game obj was instantiated by game.js code, from same YAML file.
    
    // output each type of yaml.
    var m_thing, m_type, m_key;
    var current_thing;
    for (m in yaml) {
        var renderable = {};
        // console.log(m + ": " + yaml[m] + "(" + (typeof yaml[m]) + ")")
        m_thing = yaml[m];
        m_type = (isNaN(parseInt(m))) ? m.underscore() : "element";
        m_key = "li."+ m_type;
        
        // we will try to make a thing of type m_type (or m_thing, for strings). 
        // if it works, that's how we'll define editors.
        
        switch (typeof m_thing) {
            
            case "string":
              if (m_type === "variable_name") {
                // container.attr("name", m_thing);
                container.prepend("[" + m_thing + "]");
                break;
              } else if (m_thing.match(/\s+/gi) === null) {
                try {
                  // check if m_thing is defined on the current context.
                  m_class = getAssociatedClass(context, m_thing);
                  
                  if (context.indexOf("Factory") > -1) {
                    current_thing = m_class.create(current_scope, m_thing);
                  } else {
                    current_thing = new m_class(current_scope, null, "mock");
                  }
                } catch (e) {
                  current_thing = null;
                }
              } else {
                current_thing = null;
              }

              if (current_thing !== null) {
                m_class = context + "." + m_thing;
                m_key += "[game_class=" + m_class + "]";
              }
              
              // funky way to do this, so we don't end up w String() -- array of chars -- in element.
              renderable[m_key] = "";
              var str_container = container.render(renderable).find(":last");
              str_container.replaceWith(m_thing);
              str_container.data("yaml", m_thing);
              break;
            
            case "number":
              if (m_type === "element") {
                m_type = "number";
                m_key = "li."+ m_type;
              }
              renderable[m_key] = m_thing;
              container.render(renderable);
              container.find(":last").data("yaml", m_thing);
              break;
                
            case "object":
              renderable[m_key] = ""
              
              var li_container = container.render(m_key); //.find(":last");
              // check whether its name refers to an object defined on the current context.
              // check if m_thing is defined on the current context.
              if (m_thing instanceof YAML.Array) {
                context = context.replace("Factory", "");
              }
              m_class = getAssociatedClass(context, m_type);
              nested_context = (m_class) ? scopeName(context, m_type) : context;
              
              var ul_m_thing = "";
              if (m_thing instanceof YAML) {
                  var ul_container;
                  if ((m_type === "next") && (m_thing.hasOwnProperty("variable_name"))) {
                    li_container.render({ "div.pointer": m_thing.variable_name });
                    break;
                    
                  } else if (m_thing instanceof YAML.Array) {
                    li_container.attr("type", "array");
                    var ul_spec = "ul[type=array]"
                    // if the array is named for an object defined on the current context, note that.
                    nested_context = nested_context.replace(".Element", "");
                    var ar_class = getAssociatedClass(nested_context, m_type);
                    if (ar_class) {
                      ul_spec += "[game_class=" + nested_context + "." + m_type.classify() + "]";
                    }
                    // render the completed spec.
                    ul_container = li_container.render(ul_spec);
                    
                  } else if (m_thing.hasOwnProperty("fn")) {
                    var fname = Game.getFunctionName(m_thing.fn);
                    ul_container = li_container.render({ "ul.closed[type=function]":fname }).find(":last");
                    
                  } else if (is_html_spec(m_thing)) {
                    for (var n in m_thing) {
                      li_container.append("div").html(n + " > " + m_thing[n]);
                    }
                    break;
                      
                  } else {
                    li_container.attr("type", "object");
                    ul_container = li_container.render("ul[type=object]");
                  }
                  
                  try {
                    // check if m_thing is defined on the current context.
                    if (context.indexOf("Factory") > -1) {
                      m_class = eval(context);
                      current_thing = m_class.create(current_scope, m_thing, "mock");
                    } else {
                      m_class = getAssociatedClass(context, m_type);
                      current_thing = new m_class(current_scope, m_thing, "mock");
                    }

                    if (m_class) {
                      nested_context = context.replace("Factory", "") + "." + m_type.classify();
                    }
                    current_scope = current_thing;
                  } catch (e) {
                    m_class = getAssociatedClass(context, m_type.classify() + "Factory");
                    if (m_class) {
                      nested_context = context.replace("Factory", "") + "." + m_type.classify() + "Factory";
                    }
                    current_thing = null;
                  }

                  if (ul_container && (current_thing !== null)) {
                    ul_container.attr("game_class", Game.getClassName(current_thing));
                    ul_container.data("spec", current_thing['spec'])
                  }
                  
                  renderYAML(m_thing, ul_container, nested_context, current_scope);
              }
              break;
        }
    }
}