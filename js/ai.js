// placeholder replaced below
(function () { 'use strict'; const MF = window.MF; MF.ai = { choose: function (s) { const l = MF.legalActions(s); return l.find(a => a.type !== 'cancel'); } }; })();
