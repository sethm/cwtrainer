//
// A Visual Farnsworth CW Trainer.
//
// Copyright (c) 2019, Seth Morabito <web@loomcom.com>
//
// This software is licensed under the terms of the GNU Affero GPL
// version 3.0. Please see the file LICENSE.txt for details.
//

let CwTrainer = (function () {
    // The maximum output level our GainNode should produce.
    const ON = 1.0;

    // The minimum output level our GainNode should produce.
    // Note that, due to a bug in some browsers, this must be
    // a positive value, not 0! Therefore, we default to a very
    // small (and therefore inaudible) level.
    const OFF = 0.0001;

    const FREQUENCY = 700;

    const SYMBOLS = ['.', ',', '/', '=', '?'];
    const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
                     'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
                     'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    // Our Morse Alphabet.
    const CHARS = {
        'A': '.-',
        'B': '-...',
        'C': '-.-.',
        'D': '-..',
        'E': '.',
        'F': '..-.',
        'G': '--.',
        'H': '....',
        'I': '..',
        'J': '.---',
        'K': '-.-',
        'L': '.-..',
        'M': '--',
        'N': '-.',
        'O': '---',
        'P': '.--.',
        'Q': '--.-',
        'R': '.-.',
        'S': '...',
        'T': '-',
        'U': '..-',
        'V': '...-',
        'W': '.--',
        'X': '-..-',
        'Y': '-.--',
        'Z': '--..',
        '1': '.----',
        '2': '..---',
        '3': '...--',
        '4': '....-',
        '5': '.....',
        '6': '-....',
        '7': '--...',
        '8': '---..',
        '9': '----.',
        '0': '-----',
        '/': '-..-.',
        '=': '-...-',
        '?': '..--..',
        '.': '.-.-.-',
        ',': '--..--'
    };

    const PROSIGNS = {
        'AR': '.-.-.',
        'BT': '-...-',
        'SK': '...-.-',
        'KN': '-.--.',
        'BK': '-...-.-'
    };

    // Provide a ramp of 5 ms on either side of a character element to
    // gracefully turn the oscillator on or off. This prevents
    // horrible clicking from the speakers.  (NOTE: Only partially
    // works on Firefox browser at the present time, due to a known
    // bug.)
    const RAMP = 0.005;
    
    // This is NOT an exhaustive list of US callsign prefixes,
    // but a good sampling.
    const CALLPREFIXES = [
        'K', 'N', 'W', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF',
        'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'KA', 'KB', 'KC',
        'KD', 'KE', 'KF', 'KG', 'KH', 'KI', 'KL', 'KM', 'KN',
        'NA', 'NB', 'NC', 'ND', 'NE', 'NF', 'NG', 'NH', 'NI',
        'NJ', 'NK', 'NL', 'NM', 'NN', 'WA', 'WB', 'WC', 'WD',
        'WE', 'WF', 'WG', 'WH', 'WI', 'WJ', 'WK', 'WL', 'WM',
        'WN'
    ];

    // These are the top most used words in CW, based on
    // this site:
    //
    // http://www.4sqrp.com/resource/w0xi/w0xi-100/most_common.html
    const TOPWORD_LIST = [
        'I', 'AND', 'THE', 'YOU', 'THAT', 'A', 'TO', 'KNOW',
        'OF', 'IT', 'YES', 'IN', 'THEY', 'DO', 'SO', 'BUT',
        'IS', 'LIKE', 'HAVE', 'WAS', 'WE', 'ITS', 'JUST',
        'ON', 'OR', 'NOT', 'THINK', 'FOR', 'WELL', 'WHAT',
        'ABOUT', 'ALL', 'THATS', 'OH', 'REALLY', 'ONE',
        'ARE', 'RIGHT', 'THEM', 'AT', 'HERE', 'THERE', 'MY',
        'MEAN', 'DONT', 'NO', 'WITH', 'IF', 'WHEN', 'CAN', 'U',
        'BE', 'AS', 'OUT', 'KIND', 'BECAUSE', 'PEOPLE',
        'GO', 'GOT', 'THIS', 'SOME', 'IM', 'WOULD', 'THINGS',
        'NOW', 'LOT', 'HAD', 'HOW', 'GOOD', 'GET', 'SEE',
        'FROM', 'HE', 'ME', 'DONT', 'THEIR', 'MORE',
        'TOO', 'OK', 'VERY', 'UP', 'BEEN', 'GUESS', 'TIME',
        'GOING', 'INTO', 'THOSE', 'HERE', 'DID', 'WORK',
        'OTHER', 'AND', 'IVE', 'THINGS', 'EVEN', 'OUR',
        'ANY', 'IM', 'QRL', 'QRM', 'QRN', 'QRQ', 'QRS',
        'QRZ', 'QTH', 'QSB', 'QSY', 'R', 'TU', 'RTU', 'TNX',
        'NAME', 'RST', 'CQ', 'AGN', 'ANT', 'DX', 'ES', 'FB',
        'GM', 'GA', 'GE', 'HI', 'HR', 'HW', 'NR', 'OM', 'PSE',
        'PWR', 'WX', '73', '5NN', '599', 'U', 'BTU', 'TST'
    ];

    PROSIGN_LIST = [
        '@AR', '@BT', '@SK', '@KN', '@BK'
    ];

    var fwWpm;
    var audioContext;
    var oscNode;
    var gainNode;
    var time;
    var dotWidth;
    var dashWidth;
    var charSpace;
    var wordSpace;

    var beforeCharCallback;
    var afterCharCallback;
    var afterSendCallback;
    var afterCancelCallback;

    var pendingTimeouts = [];

    class CwTrainer {

        constructor(wpm,
                    fw,
                    beforeCharCb,
                    afterCharCb,
                    afterSendCb,
                    afterCancelCb) {

            this.enableLetters = true;
            this.enableNumbers = true;
            this.enableSymbols = true;
            this.enableCallsigns = true;
            this.enableProsigns = true;

            this.setWpm(wpm, fw);

            beforeCharCallback = beforeCharCb;
            afterCharCallback = afterCharCb;
            afterSendCallback = afterSendCb;
            afterCancelCallback = afterCancelCb;

            var AudioContext = (window.AudioContext ||
                                window.webkitAudioContext ||
                                false);

            if (AudioContext) {
                audioContext = new AudioContext();

                console.log("Audio Context: " + audioContext);

                oscNode = audioContext.createOscillator();
                oscNode.type = "sine";
                oscNode.frequency.value = FREQUENCY;
                time = audioContext.currentTime + 0.5;

                gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(OFF, audioContext.currentTime);

                oscNode.connect(gainNode);
                
                gainNode.connect(audioContext.destination);

                oscNode.start();
            } else {
                console.log("Warning: Unable to create audio context");
            }
        }

        unsuspend() {
            audioContext.resume();
        }

        // Set the Words per Minute to be used by this trainer.
        setWpm(wpm, fw) {
            let fwDotWidth = 1.2 / fw;
            
            dotWidth = 1.2 / wpm;
            dashWidth = dotWidth * 3.0;
            
            charSpace = fwDotWidth * 3.0;
            wordSpace = fwDotWidth * 7.0;
        }

        makeCallSign() {
            var callsign = CALLPREFIXES[Math.floor(Math.random() * CALLPREFIXES.length)];

            callsign += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];

            callsign += LETTERS[Math.floor(Math.random() * LETTERS.length)];
            
            if (Math.random() > 0.5) {
                callsign += LETTERS[Math.floor(Math.random() * NUMBERS.length)];
            }
            
            if (Math.random() > 0.5) {
                callsign += LETTERS[Math.floor(Math.random() * NUMBERS.length)];
            }

            return callsign;
        }

        randomText(numWords) {
            var words = [];
            
            for (var i = 0; i < numWords; i++) {
                if (Math.random() < 0.05 && this.enableCallsigns) {
                    words.push(this.makeCallSign());
                } else if (Math.random() < 0.05 && this.enableProsigns) {
                    words.push(
                        PROSIGN_LIST[Math.floor(Math.random() * PROSIGN_LIST.length)]
                    );
                } else {
                    words.push(
                        TOPWORD_LIST[Math.floor(Math.random() * TOPWORD_LIST.length)]
                    );
                }
            }

            return words.join(" ");
        }
        
        randomGroups(numGroups, groupSize) {
            var groups = [];
            var alphabet = [];

            if (this.enableLetters) {
                alphabet = alphabet.concat(LETTERS);
            }

            if (this.enableNumbers) {
                alphabet = alphabet.concat(NUMBERS);
            }

            if (this.enableSymbols) {
                alphabet = alphabet.concat(SYMBOLS);
            }

            if (alphabet.length === 0) {
                return "";
            }
            
            for (var i = 0; i < numGroups; i++) {
                var group = "";
                
                for (var j = 0; j < groupSize; j++) {
                    var c = alphabet[Math.floor(Math.random() * alphabet.length)];
                    group = group + c;
                }

                groups.push(group);
            }

            return groups.join(" ");
        }

        sendMorseString(str) {
            for (var i = 0; i < str.length; i++) {
                var e = str[i];
                if (e === '.') {
                    gainNode.gain.setValueAtTime(OFF, time);
                    gainNode.gain.exponentialRampToValueAtTime(ON, time + RAMP);
                    gainNode.gain.setValueAtTime(ON, time + dotWidth);
                    gainNode.gain.exponentialRampToValueAtTime(OFF, time + dotWidth + RAMP);
                    time = time + dotWidth + RAMP;
                } else if (e === '-') {
                    gainNode.gain.setValueAtTime(OFF, time);
                    gainNode.gain.exponentialRampToValueAtTime(ON, time + RAMP);
                    gainNode.gain.setValueAtTime(ON, time + dashWidth);
                    gainNode.gain.exponentialRampToValueAtTime(OFF, time + dashWidth + RAMP);
                    time = time + dashWidth + RAMP;
                }
                if (i < str.length - 1) {
                    time = time + dotWidth + RAMP;
                }
            }
        }
        
        sendChar(c) {
            var morseValue = CHARS[c];

            if (beforeCharCallback) {
                pendingTimeouts.push(setTimeout(function() {
                    beforeCharCallback(c);
                }, (time - audioContext.currentTime) * 1000.0));
            }
            
            if (morseValue) {
                this.sendMorseString(morseValue);
            }

            if (afterCharCallback) {
                pendingTimeouts.push(setTimeout(function() {
                    afterCharCallback(c);
                }, (time - audioContext.currentTime) * 1000.0));
            }
        }

        sendProsign(prosign) {
            if (prosign.startsWith('@')) {
                prosign = prosign.substring(1, prosign.length);
            }
            
            var morseValue = PROSIGNS[prosign];

            if (beforeCharCallback) {
                pendingTimeouts.push(setTimeout(function() {
                    beforeCharCallback(prosign);
                }, (time - audioContext.currentTime) * 1000.0));
            }
            
            if (morseValue) {
                this.sendMorseString(morseValue);
            }

            if (afterCharCallback) {
                pendingTimeouts.push(setTimeout(function() {
                    afterCharCallback(prosign);
                }, (time - audioContext.currentTime) * 1000.0));
            }
        }
        
        sendWord(word) {
            if (word.startsWith('@')) {
                // Any word starting with @ is a prosign.
                this.sendProsign(word);
                return;
            }
            
            for (var i = 0; i < word.length; i++) {
                this.sendChar(word[i].toUpperCase());
                if (i < word.length - 1) {
                    time = time + charSpace;
                }
            }
        }

        sendText(text) {
            // Add a small 1/2 second delay after the send button
            // is clicked.
            gainNode.gain.setValueAtTime(OFF, audioContext.currentTime);
            time = audioContext.currentTime + 0.5;

            var words = text.split(" ");

            for (var i = 0; i < words.length; i++) {
                this.sendWord(words[i]);
                if (i < words.length - 1) {
                    time = time + wordSpace;
                }
            }

            if (afterSendCallback) {
                pendingTimeouts.push(setTimeout(afterSendCallback,
                                                (time - audioContext.currentTime) * 1000.0));
            }
        }

        cancel() {
            gainNode.gain.cancelScheduledValues(audioContext.currentTime);
            gainNode.gain.setValueAtTime(OFF, audioContext.currentTime);
            time = 0.0;

            for (var i = pendingTimeouts.length - 1; i >= 0; i--) {
                window.clearTimeout(pendingTimeouts[i]);
                pendingTimeouts.pop();
            }

            if (afterCancelCallback) {
                afterCancelCallback();
            }
        }
    }
    
    return CwTrainer;
})();
