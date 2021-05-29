/**
 * @copyright James Ding 2020
 */

/**
 * Message from toast on start. Set as `null` to prevent toast
 */
const onStartDisplayToast = 'Visit our <a href=\'https://github.com\'>Github</a> here'

/**
 * The websocket URL
 * Note that encrypted websockets use `wss://` and server must be configured properly in order to use encrypted
 * websockets
 * @type {string}
 */
const websocketURL = 'ws://localhost:6969'

/**
 * The maximum amount of replacements suggested to the user
 * @type {number}
 */
const replacementLimit = 5

/**
 * Represents the Quill editor
 * @type {Quill}
 */
let editor

/**
 * The current websocket the user is connected to
 * @type {WebSocket}
 */
var websocket

/**
 * The latest websocket ID
 * @type {number}
 */
var latestWebsocketUniqueID = 0

String.prototype.replaceBetween = function(start, end, what) {
  return this.substring(0, start) + what + this.substring(end);
};

/**
 * Displays a notification similar to Android Toasts
 * @param {string} innerHTML The message to display, in HTML
 */
function displayToast(innerHTML) {
    if (innerHTML == null) {
        return
    }
    let toastElement = document.getElementById('toast')
    toastElement.style.animation = 'none'
    toastElement.innerHTML = innerHTML
    toastElement.style.animation = 'toastNotification 4s'
}

window.onload = () => {

    /**
     * Built to ignore text changes and to prevent recursion from formatting updates
     * @type {boolean}
     */
    var ignoreTextChange = false

    /**
     * Creates a text query by sending a websocket message
     *
     * @param {string} text The text to analyze
     * @param {boolean} languageProcess Whether the text should be run through LanguageTool (3-5s expected response)
     */
    function createTextQuery(text, languageProcess) {
        latestWebsocketUniqueID += 1
        let json = JSON.stringify({
            'op': 0,
            'd': {
                'unique_id': latestWebsocketUniqueID,
                'process_language': languageProcess,
                'message': text
            }
        })

        if (languageProcess) {
            document.getElementsByClassName('lds-ellipsis')[0].className = 'lds-ellipsis visible'
            document.getElementById('analyze-button').setAttribute('data-tooltip', 'Analyzing Text...')
            document.getElementById('review-text').className = 'invisible'
        } else {
            document.getElementsByClassName('lds-ellipsis')[0].className = 'lds-ellipsis invisible'
            document.getElementById('analyze-button').setAttribute('data-tooltip', 'Click to start analyzing your text')
            document.getElementById('review-text').className = 'visible'
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
                'Disconnected': 'fail',
                'Connecting': 'mediocre',
                'Connected': 'good'
            }

            switch (innerText) {
                case 'Disconnected':
                    document.getElementById('server-status').setAttribute('data-tooltip', `Try reloading the page`)
            }

            let serverStatusText = document.getElementById('server-status-text')
            serverStatusText.innerText = innerText
            serverStatusText.className = statuses[innerText]
        }


        repeatWhileMouseOver(document.getElementById('server-status'), () => {
            sendHeartbeat()
        }, 300)

        try {
            websocket.close()
        } catch (TypeError) {
        }


        websocket = new WebSocket(websocketURL)
        setServerStatus('Connecting')

        var lastTimeSent = new Date()

        /**
         * Send a heartbeat to the server to keep the websocket connection alive. Can also be used for server ping
         */
        function sendHeartbeat() {
            lastTimeSent = new Date()
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({'op': 1}))
            } else {
                console.error('Websocket was unexpectedly closed')
            }
        }


        websocket.addEventListener('open', () => {
            console.log('Connected to websocket')
            setServerStatus('Connected')
        })

        let heartBeatInterval;
        websocket.addEventListener('message', (event) => {
            let json = JSON.parse(event.data);
            let opcode = json.op;

            switch (opcode) {
                case 0:
                    let uniqueID = json.d.unique_id
                    if (uniqueID === latestWebsocketUniqueID) {
                        console.debug(json)
                        document.getElementsByClassName('lds-ellipsis')[0].className = 'lds-ellipsis invisible'
                        document.getElementById('analyze-button').setAttribute('data-tooltip', 'Click to start analyzing your text')
                        document.getElementById('review-text').className = 'visible'


                        let wordCountElement = document.getElementById('word-count')

                        let wordCountSuffix = 'word';
                        if (json.d.text_statistics.lexicon_count !== 1) {
                            wordCountSuffix += 's'
                        }

                        let {
                            lexicon_count: lexiconCount,
                            lexicon_count_ps: lexiconCountPS,
                            syllable_count: syllableCount,
                            syllable_count_ps: syllableCountPS,
                            sentences,
                            sentence_count: sentenceCount,
                            readability: {
                                flesch_reading_ease: {
                                    score: fleschReadingEaseScore,
                                    sps: fleschReadingEaseSPS
                                },
                                smog_index: {
                                    score: smogIndexScore
                                },
                                flesch_kincaid_grade: {
                                    score: fleschKincaidGradeScore,
                                    sps: fleschKincaidGradeSPS
                                },
                                coleman_liau_index: {
                                    score: colemanLiauIndexScore,
                                    sps: colemanLiauIndexSPS
                                },
                                automated_readability_index: {
                                    score: automatedReadabilityIndexScore,
                                    sps: automatedReadabilityIndexSPS
                                },
                                dale_chall_readability_score: {
                                    score: daleChallReadabilityScore,
                                    sps: daleChallReadabilitySPS
                                },
                                difficult_words: {
                                    score: difficultWordsScore,
                                    sps: difficultWordsSPS,
                                    words: difficultWords
                                },
                                linsear_write_formula: {
                                    score: linsearWriteFormulaScore,
                                    sps: linsearWriteFormulaSPS
                                },
                                gunning_fog: {
                                    score: gunningFogScore,
                                    sps: gunningFogSPS
                                },
                                text_standard: {
                                    score: textStandardScore
                                }
                            }
                        } = json.d.text_statistics

                        wordCountElement.innerText = `${lexiconCount} ${wordCountSuffix}`
                        wordCountElement.setAttribute('data-tooltip', `${syllableCount} syllables - ${sentenceCount} sentences`)

                        let update = [
                            {
                                score: {id: 'flesch-reading-ease-score', value: fleschReadingEaseScore,},
                                chart: {object: charts.fleschReadingEase, data: fleschReadingEaseSPS}
                            },
                            {
                                score: {id: 'smog-index-score', value: smogIndexScore},
                                chart: null
                            },
                            {
                                score: {id: 'flesch-kincaid-grade-score', value: fleschKincaidGradeScore},
                                chart: {object: charts.fleschKincaidGradeChart, data: fleschKincaidGradeSPS}
                            },
                            {
                                score: {id: 'coleman-liau-index-score', value: colemanLiauIndexScore},
                                chart: {object: charts.colemanLiauIndex, data: colemanLiauIndexSPS}
                            },
                            {
                                score: {id: 'automated-readability-index-score', value: automatedReadabilityIndexScore},
                                chart: {object: charts.automatedReadabilityIndex, data: automatedReadabilityIndexSPS}
                            },
                            {
                                score: {id: 'dale-chall-readability-score', value: daleChallReadabilityScore},
                                chart: {object: charts.daleChallReadability, data: daleChallReadabilitySPS}
                            },
                            {
                                score: {id: 'difficult-words-score', value: difficultWords.score},
                                chart: {object: charts.difficultWords, data: difficultWordsScore}
                            },
                            {
                                score: {id: 'linsear-write-formula-score', value: linsearWriteFormulaScore},
                                chart: {object: charts.linsearWriteFormula, data: linsearWriteFormulaSPS}
                            },
                            {
                                score: {id: 'gunning-fog-score', value: gunningFogScore},
                                chart: {object: charts.gunningFog, data: gunningFogSPS}
                            },
                            {
                                score: {id: 'text-standard-score', value: textStandardScore},
                                chart: null
                            }
                        ]

                        update.forEach((value) => {
                            document.getElementById(value.score.id).textContent = value.score.value
                            if (value.chart !== null) {
                                updateChartData(value.chart.object, sentences, value.chart.data)
                            }
                        })


                        let languageTool = json.d.language_tool
                        if (languageTool != null) {

                            let correctAllClassName;
                            if (languageTool.length === 0) {
                                correctAllClassName = 'slider slide-out'
                            } else {
                                correctAllClassName = 'slider slide-in'
                            }
                            document.getElementById('correct-all').className = correctAllClassName

                            languageTool.forEach((match) => {
                                ignoreTextChange = true
                                editor.formatText(match.offset, match.errorLength, {
                                    'background-color': 'background-color: rgba(191, 97, 106, 0.5)' // Used just as a placeholder
                                })

                            })

                            languageTool.forEach((match, index) => {
                                createSuggestion(match)
                            })

                            document.getElementById('editor').querySelectorAll('*[style]').forEach((span) => {
                                span.className = 'suggestion-highlight'
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
                    document.getElementById('server-status').setAttribute('data-tooltip', `Latency: ${latency}ms`)
                    setTimeout(sendHeartbeat, heartBeatInterval - 5000) // 5000ms buffer
                    break
            }
        })

        websocket.addEventListener('close', () => {
            console.log('Websocket closed')
            displayToast('Disconnected from server')
            setServerStatus('Disconnected')
        })

        websocket.addEventListener('error', () => {
            setServerStatus('Disconnected')
        })
    }

    // Start websocket connection
    createWebsocket()

    // Initialize Quill editor
    editor = new Quill('#editor', {
        modules: {
            toolbar: {
                container: '#toolbar',
            }
        },
        scrollingContainer: '#editor-target-scroll',
        placeholder: 'Paste (Ctrl+Shift+V) your document here...',
        theme: 'snow'
    });

    /**
     * Creates a suggestion card
     * @param {JSON} match The match from the API
     * @param {number} index
     */
    function createSuggestion(match) {

        let replacementHTML = '';
        match.replacements.forEach((value, index) => {
            if (index > replacementLimit) {
                return;
            }
            replacementHTML += `<span class='suggestion-card-replacements'>${value}</span>\n`;
        });

        let text = '';
        editor.getContents().ops.forEach((value) => {
            text += value.insert
        })

        let phraseToFix = text.substring(match.offset, match.offset + match.errorLength)

        let footer = '<span class="suggestion-card-ignore" id="ignore">Ignore</span>\n<span class="suggestion-card-ignore" id="ignore-all">Ignore All</span>';

        if (match.replacements.length !== 0) {
            footer = '<span class="suggestion-card-replace" id="replace">Replace</span>\n' + footer
        }

        let html = `
        <div class='slider slide-in suggestion-card suggestion-card-active' rule-id='${match.ruleId}' offset='${match.offset}' error-length='${match.errorLength}'>
          <div class='suggestion-card-mini-header'>${phraseToFix} &#8226 ${match.category}</div>
          <div class='suggestion-card-content suggestion-card-content-hidden'>
            <span class='suggestion-card-content-category'>
              ${match.category}
            </span>
            <div class='suggestion-card-replacement-container'>${replacementHTML}</div>
            <div class='suggestion-card-message'>${match.message}</div>
            <div class='suggestion-card-footer'>
              ${footer}
            </div>
          </div>
        </div>
        `
        document.getElementById('suggestions-container').insertAdjacentHTML('beforeend', html)

        const suggestionCards = document.getElementsByClassName('suggestion-card')
        const createdCard = suggestionCards[suggestionCards.length - 1]

        createdCard.onclick = () => {

            // Hide all cards
            for (let value of suggestionCards) {
                value.getElementsByClassName('suggestion-card-mini-header')[0].className = 'suggestion-card-mini-header'
                value.getElementsByClassName('suggestion-card-content')[0].className = 'suggestion-card-content suggestion-card-content-hidden'
            }

            // Show current card
            createdCard.getElementsByClassName('suggestion-card-mini-header')[0].className = 'suggestion-card-mini-header suggestion-card-mini-header-hidden'
            createdCard.getElementsByClassName('suggestion-card-content')[0].className = 'suggestion-card-content'
        }

        const replacementElements = createdCard.getElementsByClassName('suggestion-card-replacements');
        for (let value of replacementElements) {
            value.onclick = () => {
                let text = '';
                editor.getContents().ops.forEach((value) => {text += value.insert})

                const offset = parseInt(createdCard.getAttribute('offset'))
                const errorLength = parseInt(createdCard.getAttribute('error-length'))

                text = text.replaceBetween(offset, offset + errorLength, value.innerText)
                createdCard.className = 'slider slide-out suggestion-card suggestion-card-active'
                setTimeout(() => {createdCard.style.display = 'none'}, 500)
                ignoreTextChange = true
                editor.setText(text)

                const refreshedSuggestions = Array.from(document.getElementsByClassName('suggestion-card'))
                for (let i = refreshedSuggestions.indexOf(createdCard) + 1; i < refreshedSuggestions.length; i++) {
                    const elementBelow = refreshedSuggestions[i]
                    let newOffset = parseInt(elementBelow.getAttribute('offset')) - (errorLength - value.innerText.length);
                    elementBelow.setAttribute('offset', newOffset.toString())
                }
            }
        }

    }

    // On editor change event (when user changes text)
    editor.on('editor-change', (eventName) => {
        if (eventName !== 'text-change') { return }

        let text = '';
        editor.getContents().ops.forEach((value) => {text += value.insert})

        if (!ignoreTextChange) {
            console.debug(`Input updated to ${text}`)
            document.getElementById('suggestions-container').innerHTML = ''
            document.getElementById('correct-all').className = 'slider'
            createTextQuery(text, false) // This query will not contain language processing (performance)

            // Clear highlight (still buggy)
            editor.removeFormat(0, editor.getLength() - 1, Quill.sources.USER)
            ignoreTextChange = true
        } else {
            ignoreTextChange = false
        }
    })



    // On review button click
    document.getElementById('analyze-button').onclick = () => {
        let text = '';
        editor.getContents().ops.forEach((value) => {text += value.insert})
        createTextQuery(text, true)
    }

    document.getElementById('correct-all').onclick = () => {
        Array.from(document.getElementsByClassName('suggestion-card')).forEach((suggestion) => {

            const firstReplacement = suggestion.getElementsByClassName('suggestion-card-replacements')[0]
            if (firstReplacement === undefined) {
                suggestion.className = 'slider slide-out suggestion-card suggestion-card-active'
                return
            }

            let text = '';
            editor.getContents().ops.forEach((value) => {text += value.insert})

            const offset = parseInt(suggestion.getAttribute('offset'))
            const errorLength = parseInt(suggestion.getAttribute('error-length'))


            text = text.replaceBetween(offset, offset + errorLength, firstReplacement.innerText)
            suggestion.className = 'slider slide-out suggestion-card suggestion-card-active'
            setTimeout(() => {suggestion.style.display = 'none'}, 500)
            ignoreTextChange = true
            editor.setText(text)

            const refreshedSuggestions = Array.from(document.getElementsByClassName('suggestion-card'))
            for (let i = refreshedSuggestions.indexOf(suggestion) + 1; i < refreshedSuggestions.length; i++) {
                const elementBelow = refreshedSuggestions[i]
                let newOffset = parseInt(elementBelow.getAttribute('offset')) - (errorLength - firstReplacement.innerText.length);
                elementBelow.setAttribute('offset', newOffset.toString())
            }
        })
        document.getElementById('correct-all').className = 'slider slide-out'


    }

    console.log('Page successfully loaded')
    displayToast(onStartDisplayToast)


}

