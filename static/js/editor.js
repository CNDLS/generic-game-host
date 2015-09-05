$(function () {

	$('#redactor').redactor({
		buttons: ['link']
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
            activateTarget(evt);
		        evt.stopPropagation();
		    });
		    // clear.
		    $("#editor_column").click(function (evt) {
		        $("#schema *").attr("state", null);
		        $(".redactor-box").css({ display: "none" });
		        evt.stopPropagation();
		        evt.stopImmediatePropagation();
		    });
		    // add elements or members.
		    $("#schema ul[type=object]").click(function (evt) {
						if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
							$(this).toggleClass("closed");
						}  if (isOnAddCntl(evt)) {
              console.log("add member to object")
						}
						evt.stopPropagation();
		    });
		    $("#schema ul[type=array]").click(function (evt) {
						if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
							$(this).toggleClass("closed");
						} else if (isOnAddCntl(evt)) {
              console.log("add item to array")
						}
						evt.stopPropagation();
		    });
				$("#schema ul.function").click(function (evt) {
						if (isOnArrow(evt)) {
              $(".redactor-box").css({ display: "none" });
              var fn_tag = $(this);
							fn_tag.toggleClass("closed");
              if (fn_tag.hasClass("closed")) {
                var params = $(evt.target).find(".params > div > ul[type=array]").eq(0).children("li");
                params = $(params).collect(function () {
                  return this.childNodes[0].nodeValue;
                }).join(", ")
                var fn_signature = " (" + params + ")";
                $(evt.target).render({ "span": fn_signature });
              } else {
                $(evt.target).children("span").remove();
              }
						}
						evt.stopPropagation();
		    });

		    // delete key.
		    $(document.body).keydown(function (evt) {
		        if (evt.keyCode === 46) {
	            var active_element = $([state=active]);
	            if (!active_element.is(":empty")) {
                if (confirm("Are you sure you want to delete " + $(evt.targetElement).className())) {
                  active_element.remove();
                }
	            }
  		        evt.stopPropagation();
  		        evt.stopImmediatePropagation();
		        }
		    });
			}
		},
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.error(XMLHttpRequest, textStatus, errorThrown);
		}
	});
});


function activateTarget(evt) {
  // console.log(evt.target);
  $("#schema *").attr("state", null);
  $(evt.target).attr("state", "active");
  // line up the editor.
  if (evt.target.nodeName === "LI") {
      $(".redactor-box").css({ display: "block" });
      $(".redactor-box").offset({ top: $(evt.target).offset().top });
  }
}

function isOnArrow(evt) {
	return (
			(evt.offsetX <= 25) &&
			(evt.offsetX >= 5) &&
			(evt.offsetY <= 25) &&
			(evt.offsetY >= 5)
		 );
}
function isOnAddCntl(evt) {
	return (
			(evt.offsetX <= 60) &&
			(evt.offsetX >= 20) &&
			(evt.offsetY <= $(evt.target).height() + 4 &&
			(evt.offsetY >= $(evt.target).height() - 16))
		 );
}

function renderYAML(yaml, container, context) {
    // init parsed_yaml_as_html as game, if nec.
    if (!container) {
        container = $("#schema");
        container.render({'h3': "&quot;" + yaml.get("Title") + "&quot;"});
        container.render('ul[type=object]');
        container = container.find('ul[type=object]');
        context = "Game";
    }
    // output each type of yaml.
    var m_thing, m_key;
    for (m in yaml) {
        var renderable = {};
        // console.log(m + ": " + yaml[m] + "(" + (typeof yaml[m]) + ")")
        m_thing = yaml[m];
        switch (typeof m_thing) {
            
            case "string":
                if ((typeof window[m_thing] === "function") 
                    || ((typeof window[context] === "function") && (typeof window[context][m_thing] === "function"))) {
                    m_key = "li.fn." + m;
                    // look for functions defined on the current context.
                    // NOTE: requires ***strict*** naming conventions,
                    // eg; Scenes -> Game.Scene
                    try {
                        var test_context = eval("window[\"" + context + "\"][\"" + m.singularize() + "\"]");
                        if (test_context) { test_context = m.singularize() }
                    } catch (e) {
                        // console.log("Couldn't eval", e)
                    }
                } else {
                    m_key = (isNaN(parseInt(m))) ? "li." + m.underscore() : "li.element";
										if (m.underscore() === "variable_name") { 
											container.prev().append(" [" + m_thing + "]");
											break; 
										}
                }
                renderable[m_key] = "";
                var str_container = container.render(renderable).find(":last");
                str_container.replaceWith(m_thing);
                break;
            
            case "number":
                m_key = (isNaN(parseInt(m))) ? "li." + m.underscore() : "li.element";
                renderable[m_key] = m_thing;
                container.render(renderable);
                break;
                
            case "object":
                // look for functions defined on the current context.
                // NOTE: requires ***strict*** naming conventions,
                // eg; Scenes -> Game.Scene
                var nested_context = context;
                try {
                    var nested_context = eval("window[\"" + context + "\"][\"" + m.singularize() + "\"]");
                    if (nested_context){ nested_context = m.singularize() };
                } catch (e) {
                    // console.log("Couldn't eval", e)
                }
                
                // if m resolves to an integer, it's just an array index.
                var m_key;
                if (isNaN(parseInt(m))) {
                    m_key = "li." + m.underscore();
                    renderable[m_key] = ""
                } else {
                    m_key = "li.element";
                    if (nested_context) {
                        renderable[m_key] = nested_context;
                    } else {
                        renderable[m_key] = "";
                    }
                }
                
                var li_container = container.render(renderable).find(":last");
                
                if (m_thing instanceof YAML) {
                    var ul_container;
										if ((m.underscore() === "next") && (m_thing.hasOwnProperty("variable_name"))) {
											li_container.render(" &#8594; " + m_thing.variable_name);
											break;
										} else if (m_thing.hasOwnProperty("0")) {
                        ul_container = li_container.render("ul[type=array]");
                    } else if (m_thing.hasOwnProperty("fn")) {
												var fname = Game.getFunctionName(m_thing.fn);
												ul_container = li_container.render({ "ul.function[type=function]": fname }).find(":last");
										} else {
                        ul_container = li_container.render("ul[type=object]");
                    }
										
										renderYAML(m_thing, ul_container, nested_context);
                }
                break;
        }
    }
    
}