/**
 * @copyright James Ding 2020
 */

/**
 * Message from toast on start. Set as null to prevent toast
 */
const onStartDisplayToast = "Visit our <a href=\"https://github.com\">Github</a> here"

/**
 * The websocket URL
 * 
 * Note that encrypted websockets use wss:// and server must be configured properly in order to use encrypted websockets
 */
const websocketURL = "ws://localhost:6969"

/**
 * The delay until the websocket request is put into the queue, ensuring that the user isn't changing the text
 */
const queueDelay = 0

/**
 * The maximum amount of replacements suggested to the user
 */
const replacementLimit = 5


/**
 * Represents the Quill editor
 */
let editor

/**
 * The current websocket the user is connected to
 */
var websocket

// The latest websocket request ID
var latestWebsocketUniqueID = 0

/**
 * The canvas ID's for the gauges, which is required for initializing the gauge using Gauge.js
 */
var gauges = ["flesch-reading-ease-gauge"]

/**
 * The JSON representing the initialized gauges
 */
var initializedGauges = {}

/**
 * Displays a notification similar to Android Toasts
 * @param {string} innerHTML The message to display, in HTML
 */
function displayToast(innerHTML) {
  if (innerHTML == null) {
    return
  }
  let toastElement = document.getElementById("toast")
  toastElement.style.animation = "none"
  toastElement.offsetHeight
  toastElement.innerHTML = innerHTML
  toastElement.style.animation = "toastNotification 4s "
}

window.onload = () => {

  /**
   * Built to ignore text changes and to prevent recursion from formatting updates
   */
  var ignoreTextChange = false
  
  /**
   * Creates a text query by sending a websocket message
   * 
   * @param {string} text The text to analyze
   * @param {boolean} languageProcess Whether the text should be run through LanguageTool (3-5s expected response)
   */
  function createTextQuery(text, languageProcess) {
    latestWebsocketUniqueID++
    let json = JSON.stringify({
      "op": 0,
      "d": {
        "unique_id": latestWebsocketUniqueID,
        "process_language": languageProcess,
        "message": text
      }
    })

    if (languageProcess) {
      document.getElementsByClassName("lds-ellipsis")[0].className = "lds-ellipsis visible"
      document.getElementById("review").setAttribute("data-tooltip", "Analyzing Text...")
      document.getElementById("review-text").className = "invisible"
    } else {
      document.getElementsByClassName("lds-ellipsis")[0].className = "lds-ellipsis invisible"
      document.getElementById("review").setAttribute("data-tooltip", "Click to start analyzing your text")
      document.getElementById("review-text").className = "visible"
    }

    websocket.send(json)
      
  }

  /**
   * Creates the websocket connection
   */
  function createWebsocket() {

    /**
     * Executes the function while mouse is over element
     */
    function repeatWhileMouseOver(element, action, milliseconds) {
      var interval = null;
      element.addEventListener('mouseover', function () {
          interval = setInterval(action, milliseconds);
      });
  
      element.addEventListener('mouseout', function () {
          clearInterval(interval);
      });
    }

    /**
     * Set's the server status
     * 
     * @param {string} innerText The text to set the server status to
     */
    function setServerStatus(innerText) {

      let statuses = {
        "Disconnected": "fail",
        "Connecting": "mediocre",
        "Connected": "good"
      }
  
      switch (innerText) {
        case "Disconnected":
          document.getElementById("server-status").setAttribute("data-tooltip", `Try reloading the page`)
      }
    
      let serverStatusText = document.getElementById("server-status-text")
      serverStatusText.innerText = innerText
      serverStatusText.className = statuses[innerText]
    }
    

    repeatWhileMouseOver(document.getElementById("server-status"), () => {
      sendHeartbeat()
    }, 300)

    try {
      websocket.close()
    } catch(TypeError) {}

    
    websocket = new WebSocket(websocketURL)
    setServerStatus("Connecting")
    
    var lastTimeSent = new Date()
  
    /**
     * Send a heartbeat to the server to keep the websocket connection alive. Can also be used for server ping
     */
    function sendHeartbeat() {
      lastTimeSent = new Date()
      if (websocket.readyState == WebSocket.OPEN) {
        websocket.send(JSON.stringify({"op": 1}))
      } else {
        console.error("Websocket was unexpectedly closed")
      } 
    }
      
  
    websocket.addEventListener("open", () => {
      console.log("Connected to websocket")
      setServerStatus("Connected")
    })
  
    let heartBeatInterval
    websocket.addEventListener("message", (event) => {
      json = JSON.parse(event.data)
      opcode = json.op
  
      switch (opcode) {
        case 0:
          let uniqueID = json.d.unique_id
          if (uniqueID == latestWebsocketUniqueID) {
            console.debug(json)
            document.getElementsByClassName("lds-ellipsis")[0].className = "lds-ellipsis invisible"
            document.getElementById("review").setAttribute("data-tooltip", "Click to start analyzing your text")
            document.getElementById("review-text").className = "visible"


            let wordcount = document.getElementById("word-count")

            var wordCountSuffix = "word"
            if (json.d.text_statistics.lexicon_count != 1) {
              wordCountSuffix += "s"
            }

            wordcount.innerText = `${json.d.text_statistics.lexicon_count} ${wordCountSuffix}`
            wordcount.setAttribute("data-tooltip", `${json.d.text_statistics.syllable_count} syllables - ${json.d.text_statistics.sentence_count} sentences`)

            let languageTool = json.d.language_tool
            if (languageTool != null) {

              let correctAllClassName
              if (languageTool.length == 0) {
                correctAllClassName = "slider slide-out"
              } else {
                correctAllClassName = "slider slide-in"
              }
              document.getElementById("correct-all").className = correctAllClassName

              languageTool.forEach((match) => {
                ignoreTextChange = true
                editor.formatText(match.offset, match.errorLength, { 
                  "background-color": "background-color: rgba(191, 97, 106, 0.5)" // Used just as a placeholder
                })

              })

              languageTool.forEach((match) => {
                createSuggestion(match)
              })

              document.getElementById("editor").querySelectorAll("*[style]").forEach((span, index) => {
                span.className = "suggestion-highlight"
              })

            }
            
          }
          break
        case 10:
          heartBeatInterval = json.d.heartbeat
          console.log(`Given heartbeat: ${heartBeatInterval}ms`)
          setTimeout(sendHeartbeat, heartBeatInterval - 5000)
          break
        case 11:
          let latency = new Date() - lastTimeSent
          document.getElementById("server-status").setAttribute("data-tooltip", `Latency: ${latency}ms`)
          setTimeout(sendHeartbeat, heartBeatInterval - 5000)
          break
      }
    })
  
    websocket.addEventListener("close", () => {
      console.log("Websocket closed")
      displayToast("Disconnected from server")
      setServerStatus("Disconnected")
    })
  
    websocket.addEventListener("error", () => {
      setServerStatus("Disconnected")
    })
  }

  const defaultGagueOptions = {
    angle: 0.35,
    lineWidth: 0.1,
    radiusScale: 1,
    pointer: {
      length: 0.6,
      strokeWidth: 0.035,
      color: '#000000'
    },
    limitMax: false,
    limitMin: false,
    colorStart: '#A3BE8C',
    colorStop: '#A3BE8C',
    strokeColor: '#EEEEEE', 
    generateGradient: true,
    highDpiSupport: true
  }

  gauges.forEach((value) => {
    let element = document.getElementById(value)
    let gauge = new Donut(element).setOptions(defaultGagueOptions)

    gauge.maxValue  = 100; // set max gauge value
    gauge.setMinValue(0)

    initializedGauges[value] = gauge
  })


  createWebsocket()
  

  editor = new Quill("#editor", {
    modules: { 
      toolbar: { 
        container: '#toolbar',
      }
    },
    scrollingContainer: "#editor-target-scroll",
    placeholder: "Paste (Ctrl+Shift+V) your document here...",
    theme: "snow"
  });

  function createSuggestion(match) {

    var replacementHTML = ""
    match.replacements.forEach((value, index) => {
      if (index > replacementLimit) {
        return
      }
      replacementHTML += `<span class="suggestion-card-replacements">${value}</span>\n`
    })

    var text = ""
    editor.getContents().ops.forEach((value) => {
      text += value.insert
    })

    let phraseToFix = text.substring(match.offset, match.offset + match.errorLength)
    
    var footer = '<span class="suggestion-card-ignore" id="ignore">Ignore</span>\n<span class="suggestion-card-ignore" id="ignore-all">Ignore All</span>'

    if (match.replacements.length != 0) {
      footer = '<span class="suggestion-card-replace" id="replace">Replace</span>\n' + footer
    }

    let html = `
    <div class="slider slide-in suggestion-card suggestion-card-active" rule-id="${match.ruleId}">
      <div class="suggestion-card-mini-header">${phraseToFix} &#8226 ${match.category}</div>
      <div class="suggestion-card-content suggestion-card-content-hidden">
        <span class="suggestion-card-content-category">
          ${match.category}
        </span>
        <div class="suggestion-card-replacement-container">${replacementHTML}</div>
        <div class="suggestion-card-message">${match.message}</div>
        <div class="suggestion-card-footer">
          ${footer}
        </div>
      </div>
    </div>
    `
    console.debug(`Created suggest card: ${html}`)
    document.getElementById("suggestions-container").insertAdjacentHTML("beforeend", html)

    let suggestionCards = document.getElementsByClassName("suggestion-card")
    let createdCard = suggestionCards[suggestionCards.length - 1]    

    createdCard.onclick = () => {

      // Hide all cards
      for (value of suggestionCards) {
        value.getElementsByClassName("suggestion-card-mini-header")[0].className = "suggestion-card-mini-header"
        value.getElementsByClassName("suggestion-card-content")[0].className = "suggestion-card-content suggestion-card-content-hidden"
      }

      // Show current card
      createdCard.getElementsByClassName("suggestion-card-mini-header")[0].className = "suggestion-card-mini-header suggestion-card-mini-header-hidden"
      createdCard.getElementsByClassName("suggestion-card-content")[0].className = "suggestion-card-content"
    }
  

  }

  // On editor change event (when user changes text)
  editor.on("text-change", () => {
    document.getElementById("suggestions-container").innerHTML = ""
    var text = ""
    editor.getContents().ops.forEach((value) => {
      text += value.insert
    })
    

    if (!ignoreTextChange) {
      console.debug(`Input updated to ${text}`)
      document.getElementById("correct-all").className = "slider"
      createTextQuery(text, false) // This query will not contain language processing (performance)

      // Clear highlight (still buggy)
      ignoreTextChange = true
      editor.removeFormat(0, editor.getLength() - 1, Quill.sources.USER)
    } else {
      ignoreTextChange = false
    }    
  })

  // On review button click
  document.getElementById("review").onclick = () => {
    var text = ""
    editor.getContents().ops.forEach((value) => {text += value.insert})
    createTextQuery(text, true)
  }  

  console.log("Page successfully loaded")
  displayToast(onStartDisplayToast)

}