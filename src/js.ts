/// <reference types="vite/client" />

import { el, text, setStyle } from "redom";

import localforage from "localforage";
import { extendPrototype } from "localforage-setitems";
extendPrototype(localforage);

import "@oddbird/popover-polyfill";

import ok_svg from "../assets/icons/ok.svg";
import todo_svg from "../assets/icons/todo.svg";
import close_svg from "../assets/icons/close.svg";
import add_svg from "../assets/icons/add.svg";

function icon(src: string) {
    return `<img src="${src}" class="icon">`;
}
function iconEl(src: string) {
    return el("img", { src, class: "icon", alt: "按钮图标" });
}

function uuid() {
    if (crypto.randomUUID) {
        return crypto.randomUUID().slice(0, 8);
    } else {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0,
                v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16).slice(0, 8);
        });
    }
}

function time() {
    return new Date().getTime();
}

if ("serviceWorker" in navigator) {
    if (import.meta.env.PROD) {
        navigator.serviceWorker.register("/sw.js");
    }
}

var setting = localforage.createInstance({
    name: "setting",
    driver: localforage.LOCALSTORAGE,
});

type Event = {
    id: string;
    start: Date;
    end: Date;
    name: string;
    note: string;
};

let todos: { event: Event; fixed?: boolean }[] = [];

let events: Event[] = [
    { id: "", name: "test", note: "", start: new Date("2024-3-13 12:00"), end: new Date("2024-3-13 14:00") },
];

/************************************UI */
function dialogX(el: HTMLDialogElement) {
    document.body.append(el);
    el.showModal();
    el.addEventListener("close", () => {
        el.remove();
    });
}

const cal = el("div", { class: "cal" });
const timeLine = el("div", { class: "timeline" });

const dayEl = (date: Date) => {
    return el("div", { class: "day" }, [date.getDate()]);
};

function dateStr(date: Date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const dayTime = 24 * 60 * 60 * 1000;

const dayEl2 = (date: Date) => {
    const div = el("div", { "data-date": dateStr(date) });
    for (let i = 0; i < 24; i++) {
        div.append(el("div"));
    }
    const start = new Date(dateStr(date));
    const end = new Date(start.getTime() + dayTime);
    const es = events.filter((e) => !(e.end.getTime() <= start.getTime() || end.getTime() <= e.start.getTime()));
    es.forEach((e) => {
        let eStart = e.start;
        let eEnd = e.end;
        if (eStart.getTime() < start.getTime()) {
            eStart = start;
        }
        if (eEnd.getTime() > end.getTime()) {
            eEnd = end;
        }
        let top = (eStart.getTime() - start.getTime()) / dayTime;
        let height = (eEnd.getTime() - eStart.getTime()) / dayTime;
        div.append(
            el("div", { class: "event", style: { height: `${height * 100}%`, top: top * 100 + "%" } }, [
                el("div", e.name),
            ])
        );
    });
    return div;
};

function timeRange(centerDate: Date, partLen: number) {
    const timeList: Date[] = [];
    const start = new Date(centerDate.getTime() - partLen * dayTime);
    for (let i = 0; i < partLen * 2 + 1; i++) {
        const date = new Date(start.getTime() + i * dayTime);
        timeList.push(date);
    }
    return timeList;
}

function daysView(centerDate: Date, partLen: number) {
    const timeList = timeRange(centerDate, partLen);
    const div = el("div");
    for (let d of timeList) {
        div.append(dayEl(d));
    }
    return div;
}

function setCalView(type: "") {
    cal.innerHTML = "";
    cal.append(daysView(new Date(), 2));
}

function setTimeLine(centerDate: Date, partLen: number) {
    const timeList = timeRange(centerDate, partLen);
    const div = el("div");
    for (let d of timeList) {
        div.append(dayEl2(d));
    }

    timeLine.innerHTML = "";
    timeLine.append(div);
}

function setPointer() {
    const now = new Date();
    let todayEl = timeLine.querySelector(`[data-date="${dateStr(now)}"]`);
    const top = (now.getTime() - new Date(dateStr(now)).getTime()) / dayTime;
    if (todayEl) {
        let pointer = todayEl.querySelector(".pointer") as HTMLElement;
        if (!pointer) {
            pointer = el("div", { class: "pointer" });
            todayEl.append(pointer);
        }
        pointer.style.top = top * 100 + "%";
    }
}

function add() {
    const dialog = el("dialog") as HTMLDialogElement;
    const name = el("input");
    const startDate = el("input");
    const endDate = el("input");
    const note = el("textarea");
    const ok = el(
        "button",
        {
            onclick: () => {
                dialog.close();
                let event: Event = {
                    id: uuid(),
                    name: name.value,
                    start: startDate.value ? new Date(startDate.value) : null,
                    end: endDate.value ? new Date(endDate.value) : null,
                    note: note.value,
                };
                if (!startDate.value) {
                    todos.push({ event });
                } else {
                    if (!endDate.value) {
                        event.end = new Date(new Date(startDate.value).getTime() + 1000 * 60 * 5);
                    }
                    events.push(event);
                    setTimeLine(new Date(), 3);
                }
            },
        },
        iconEl(ok_svg)
    );
    const close = el(
        "button",
        {
            onclick: () => {
                dialog.close();
            },
        },
        iconEl(close_svg)
    );
    dialog.append(el("h1", "添加"), name, startDate, endDate, note, close, ok);
    dialogX(dialog);
}

function todo() {
    const dialog = el("dialog") as HTMLDialogElement;
    const div = el("div");
    for (let i of todos.toReversed()) {
        div.append(
            el(
                "p",
                {
                    onclick: () => {
                        dialog.close();
                        const event = structuredClone(i.event);
                        event.start = new Date();
                        if (!event.end) {
                            event.end = new Date(new Date().getTime() + 1000 * 60 * 5);
                        }
                        events.push(event);
                        setTimeLine(new Date(), 3);
                        if (!i.fixed) {
                            todos = todos.filter((e) => e !== i);
                        }
                    },
                },
                i.event.name
            )
        );
    }
    if (!todos.length) div.append(el("p", "没有代办"));
    dialog.append(el("h1", "代办"), div);
    dialogX(dialog);
}

document.body.append(cal, timeLine);
document.body.append(
    el("div", { class: "button_bar" }, [
        el("button", { onclick: todo }, iconEl(todo_svg)),
        el("button", { onclick: add }, iconEl(add_svg)),
    ])
);

setCalView("");
setTimeLine(new Date(), 2);

setPointer();

setInterval(() => {
    setPointer();
}, 1000);
