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
		    $("#schema, #editor_column").click(function (evt) {
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
              // console.log("add item to array")
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
        // initialize functions in closed state.
        $("#schema ul[type=function]").each(function () {
          var params = $(this).find(".params > div > ul[type=array]").eq(0).children("li");
          params = $(params).collect(function () {
            return this.childNodes[0].nodeValue;
          }).join(", ")
          var fn_signature = " (" + params + ")";
          $(this).render({ "span": fn_signature });
        });

		    // delete key.
		    $(document.body).keydown(function (evt) {
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


function activateTarget(evt_target) {
  // console.log(evt.target);
  $("#schema *").attr("state", null);
  $(evt_target).attr("state", "active");
  // line up the editor.
  if (evt_target.nodeName === "LI") {
      $(".redactor-box").css({ display: "block" });
      $(".redactor-box").offset({ top: $(evt_target).offset().top });
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
        context = game; // game obj was instantiated by game.js code, from same YAML file.
    }
    // output each type of yaml.
    var m_thing, m_type, m_key;
    for (m in yaml) {
        var renderable = {};
        // console.log(m + ": " + yaml[m] + "(" + (typeof yaml[m]) + ")")
        m_thing = yaml[m];
        m_type = (isNaN(parseInt(m))) ? m.underscore() : "element";
        m_key = "li."+ m_type;
        
        switch (typeof m_thing) {
            
            case "string":
								if (m_type === "variable_name") {
                  // container.attr("name", m_thing);
                  container.prepend("[" + m_thing + "]");
									break;
								} else {
                  // check if m_thing is defined on the current context.
                  m_class = Game.getClassName(context[m_thing]);
                  console.log(m_type, m_class);
								}
                // funky way to do this, so we don't end up w String() -- array of chars -- in element.
                renderable[m_key] = "";
                var str_container = container.render(renderable).find(":last");
                str_container.replaceWith(m_thing);
                break;
            
            case "number":
              if (m_type === "element") {
                m_type = "number";
                m_key = "li."+ m_type;
              }
                renderable[m_key] = m_thing;
                container.render(renderable);
                break;
                
            case "object":
                renderable[m_key] = ""
                var li_container = container.render(renderable).find(":last");
                
                if (m_thing instanceof YAML) {
                    var ul_container;
										if ((m_type === "next") && (m_thing.hasOwnProperty("variable_name"))) {
											li_container.render({ "div.pointer": m_thing.variable_name });
											break;
										} else if (m_thing.hasOwnProperty("0")) {
                        ul_container = li_container.render("ul[type=array]");
                    } else if (m_thing.hasOwnProperty("fn")) {
												var fname = Game.getFunctionName(m_thing.fn);
												ul_container = li_container.render({ "ul.function.closed[type=function]": fname }).find(":last");
										} else {
                        ul_container = li_container.render("ul[type=object]");
                    }
										
										renderYAML(m_thing, ul_container, context);
                }
                break;
        }
    }
}