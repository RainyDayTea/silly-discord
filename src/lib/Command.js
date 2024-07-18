"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Command = void 0;
var Command = /** @class */ (function () {
    function Command(name, data, init, exec) {
        this.name = name;
        this.data = data;
        this.init = init;
        this.exec = exec;
    }
    return Command;
}());
exports.Command = Command;
