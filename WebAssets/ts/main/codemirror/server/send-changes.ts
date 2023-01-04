import type { Text, ChangeSet } from '@codemirror/state';
import { ViewPlugin, PluginValue } from '@codemirror/view';
import type { Session } from '../../session';

function sendReplace(session: Session, from: number, to: number, text: Text, cursorOffset: number) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    session.sendPartialText({
        start: from,
        length: to - from,
        newText: text.toString(),
        cursorIndexAfter: cursorOffset
    });
}

function sendChanges(session: Session, changes: ChangeSet, prevCursorOffset: number, cursorOffset: number) {
    let changeCount = 0;
    let firstFrom: number|undefined;
    let firstTo: number|undefined;
    let firstText: Text|undefined;
    changes.iterChanges((from, to, _f, _t, inserted) => {
        changeCount += 1;
        if (changeCount === 1) {
            firstFrom = from;
            firstTo = to;
            firstText = inserted;
            return;
        }

        if (changeCount === 2) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            sendReplace(session, firstFrom!, firstTo!, firstText!, cursorOffset);
        }

        sendReplace(session, from, to, inserted, cursorOffset);
    });

    if (changeCount === 1) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (firstFrom === prevCursorOffset && firstTo === firstFrom && firstText!.length === 1) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises, @typescript-eslint/no-non-null-assertion
            session.sendTypeChar(firstText!.line(1).text.charAt(0));
            return true;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sendReplace(session, firstFrom!, firstTo!, firstText!, cursorOffset);
    }
}

export const sendChangesToServer = (session: Session) => ViewPlugin.define(view => {
    session.setFullText({
        getText: () => view.state.doc.toString(),
        getCursorIndex: () => view.state.selection.main.from
    });

    return {
        update({ docChanged, selectionSet, changes, state, startState }) {
            const prevCursorOffset = startState.selection.main.from;
            const cursorOffset = state.selection.main.from;

            if (docChanged) {
                sendChanges(session, changes, prevCursorOffset, cursorOffset);
                return; // this will send selection move so we don't have to repeat
            }

            if (selectionSet) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                session.sendMoveCursor(cursorOffset);
            }
        }
    } as PluginValue;
});