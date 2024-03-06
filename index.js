'use strict';
require('dotenv').config()
const BootBot = require('bootbot');
const process = require('process');
const {google} = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

const {authenticate} = require('@google-cloud/local-auth');

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

const bot = new BootBot({
    accessToken: process.env.FB_ACCESS_TOKEN || "",
    verifyToken: process.env.FB_VERIFY_TOKEN || "",
    appSecret: process.env.FB_APP_SECRET || ""
});

const regex = /log (.*?)\s+(\d+)$/
let auth = null;


async function getAuth() {
    try {
        return google.auth.fromJSON({
            "type": "authorized_user",
            "client_id": process.env.GSHEET_CLIENT_ID,
            "client_secret": process.env.GSHEET_CLIENT_SECRET,
            "refresh_token": process.env.GSHEET_REFRESH_TOKEN,
        });
    } catch (err) {
        return null;
    }
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function AppendDataToSheet({date, content, price}) {

    const sheets = google.sheets({version: 'v4', auth});

    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GSHEET_ID,
        includeValuesInResponse: false,
        valueInputOption: 'USER_ENTERED',
        range: 'logs!A:C',
        requestBody: {
            values: [[date, content, price]]
        }
    })
}

async function getTotalPay() {
    const sheets = google.sheets({version: 'v4', auth});

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GSHEET_ID,
        range: 'logs!E2:E2',
    })

    return res.data.values
}

(async () => {
    bot.start();
    auth = await getAuth()
})()

const format = (price) => {
    return new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(price)
}

const getPayTime = () => {
    const m = new Date();
    return m.getUTCFullYear() + "-" +
        ("0" + (m.getUTCMonth()+1)).slice(-2) + "-" +
        ("0" + m.getUTCDate()).slice(-2) + " " +
        ("0" + m.getHours()).slice(-2) + ":" +
        ("0" + m.getMinutes()).slice(-2) + ":" +
        ("0" + m.getSeconds()).slice(-2);
}

bot.hear(regex, async (payload, chat) => {
    const text = payload.message.text;
    const messageArr = text.split(regex)
    const content = messageArr[1];
    const price = Number(messageArr[2]);
    await chat.say(`Bạn mới chi: ${format(price)} cho việc ${content}`);

    if (auth) {
        await AppendDataToSheet({
            date:getPayTime(),
            content,
            price
        })
        const total = await getTotalPay()
        await chat.say(`Tổng tiền đã chi là: ${total[0][0] || 0}`)
    }
})