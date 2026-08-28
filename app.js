const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxkHdYOtBLbpMPDCgDqtBdiltcYvNAhcnVIN3sRFd_SvElx9ZuGXIqPlgD9Uw_6MZN1/exec";


let state = {

  studentId: "",
  studentName: "",

  theme: "",
  stage: "",

  turn: 0,

  basicTurns: 10,
  maxTurns: 20,

  history: [],

  currentAIMessage: ""
};


const $ =
  id => document.getElementById(id);


// ==================================================
// 通信
// ==================================================

async function postRequest(data) {

  const response =
    await fetch(
      GAS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(data)
      }
    );


  const text =
    await response.text();


  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      "サーバーから正しい応答がありませんでした。"
    );
  }
}


// ==================================================
// 生徒番号
// ==================================================

$("studentId")
  .addEventListener(
    "input",
    event => {

      event.target.value =
        event.target.value
          .replace(/\D/g, "")
          .slice(0, 4);
    }
  );


// ==================================================
// ボタン
// ==================================================

$("startBtn")
  .addEventListener(
    "click",
    startSession
  );


$("answerBtn")
  .addEventListener(
    "click",
    submitAnswer
  );


$("endBtn")
  .addEventListener(
    "click",
    finishSession
  );


$("copyBtn")
  .addEventListener(
    "click",
    copyHistory
  );


$("restartBtn")
  .addEventListener(
    "click",
    () => location.reload()
  );
$("mindmapBtn")
  .addEventListener(
    "click",
    showMindmap
  );

$("backSummaryBtn")
  .addEventListener(
    "click",
    () => {

      $("mindmapScreen")
        .classList.add("hidden");

      $("summaryScreen")
        .classList.remove("hidden");
    }
  );

$("printMindmapBtn")
  .addEventListener(
    "click",
    () => window.print()
  );

// ==================================================
// 開始
// ==================================================

async function startSession() {

  const studentId =
    $("studentId").value.trim();

  const studentName =
    $("studentName").value.trim();

  const theme =
    $("theme").value.trim();

  const stage =
    $("stage").value;


  if (!/^\d{4}$/.test(studentId)) {

    $("startMessage").textContent =
      "生徒番号は半角数字4桁で入力してください。";

    return;
  }


  if (
    !studentName ||
    !theme ||
    !stage
  ) {

    $("startMessage").textContent =
      "氏名・探究テーマ・探究段階を入力してください。";

    return;
  }


  $("startBtn").disabled = true;

  $("startMessage").textContent =
    "接続しています…";


  try {

    const settingsResult =
      await postRequest({
        action: "settings"
      });


    if (
      settingsResult.success &&
      settingsResult.settings
    ) {

      state.basicTurns =
        Number(
          settingsResult
            .settings
            .basicTurns
        ) || 10;


      state.maxTurns =
        Number(
          settingsResult
            .settings
            .maxTurns
        ) || 20;
    }


    state.studentId =
      studentId;

    state.studentName =
      studentName;

    state.theme =
      theme;

    state.stage =
      stage;

    state.turn = 0;

    state.history = [];


    const result =
      await postRequest({

        action: "start",

        studentId:
          state.studentId,

        studentName:
          state.studentName,

        theme:
          state.theme,

        stage:
          state.stage
      });


    if (!result.success) {

      throw new Error(
        result.error ||
        "開始できませんでした。"
      );
    }


    state.currentAIMessage =
      result.message;


    $("themeTitle").textContent =
      state.theme;

    $("stageTitle").textContent =
      state.stage;


    $("startScreen")
      .classList.add("hidden");

    $("chatScreen")
      .classList.remove("hidden");


    addAIMessage(
      result.message
    );


    updateProgress();


    $("answer").focus();


  } catch (error) {

    console.error(error);

    $("startMessage").textContent =
      error.message;

  } finally {

    $("startBtn").disabled = false;
  }
}


// ==================================================
// 回答送信
// ==================================================

async function submitAnswer() {

  const message =
    $("answer").value.trim();


  if (!message) {

    $("chatMessage").textContent =
      "回答を入力してください。";

    return;
  }


  $("answerBtn").disabled = true;

  $("endBtn").disabled = true;

  $("chatMessage").textContent =
    "AIが考えています…";


  addStudentMessage(
    message
  );


  state.turn++;


  /*
   * 今回の1往復を
   * ローカル履歴へ追加
   */
  state.history.push({

    ai:
      state.currentAIMessage,

    student:
      message
  });


  $("answer").value = "";


  try {

    /*
     * 最大回数なら
     * AIを呼ばず終了
     */
    if (
      state.turn >= state.maxTurns
    ) {

      await finishSession();

      return;
    }


    const result =
      await postRequest({

        action: "chat",

        studentId:
          state.studentId,

        studentName:
          state.studentName,

        theme:
          state.theme,

        stage:
          state.stage,

        turn:
          state.turn,

        aiMessage:
          state.currentAIMessage,

        message,

        history:
          state.history
      });


    if (!result.success) {

      throw new Error(
        result.error ||
        "AIとの通信に失敗しました。"
      );
    }


    state.currentAIMessage =
      result.message;


    addAIMessage(
      result.message
    );


    updateProgress();


    /*
     * 基本10回に達したら
     * 終了するか続けるか選べる
     */
    if (
      state.turn >= state.basicTurns
    ) {

      $("chatMessage").textContent =
        "10回の壁打ちが終わりました。ここで終了しても、もう少し続けてもかまいません。";

    } else {

      $("chatMessage").textContent =
        "";
    }


  } catch (error) {

    console.error(error);

    $("chatMessage").textContent =
      error.message;

  } finally {

    $("answerBtn").disabled = false;

    $("endBtn").disabled = false;

    $("answer").focus();
  }
}


// ==================================================
// AIメッセージ
// ==================================================

function addAIMessage(text) {

  const block =
    document.createElement("div");

  block.className =
    "messageBlock";


  block.innerHTML = `
    <div class="sender">AI</div>
    <div class="aiMessage"></div>
  `;


  block
    .querySelector(".aiMessage")
    .textContent =
      text;


  $("chatArea")
    .appendChild(block);


  scrollChat();
}


// ==================================================
// 生徒メッセージ
// ==================================================

function addStudentMessage(text) {

  const block =
    document.createElement("div");

  block.className =
    "messageBlock";


  block.innerHTML = `
    <div class="sender">あなた</div>
    <div class="studentMessage"></div>
  `;


  block
    .querySelector(".studentMessage")
    .textContent =
      text;


  $("chatArea")
    .appendChild(block);


  scrollChat();
}


// ==================================================
// スクロール
// ==================================================

function scrollChat() {

  const area =
    $("chatArea");


  area.scrollTop =
    area.scrollHeight;
}


// ==================================================
// 進捗
// ==================================================

function updateProgress() {

  if (
    state.turn <
    state.basicTurns
  ) {

    $("progress").textContent =
      `壁打ち ${state.turn + 1} / ${state.basicTurns}`;

  } else {

    $("progress").textContent =
      `追加の壁打ち ${state.turn + 1} / ${state.maxTurns}`;
  }
}


// ==================================================
// 終了
// ==================================================

async function finishSession() {

  $("answerBtn").disabled = true;

  $("endBtn").disabled = true;


  try {

    await postRequest({

      action: "finish",

      studentId:
        state.studentId,

      theme:
        state.theme,

      turn:
        state.turn
    });

  } catch (error) {

    console.error(
      "終了保存エラー:",
      error
    );
  }


  $("chatScreen")
    .classList.add("hidden");

  $("summaryScreen")
    .classList.remove("hidden");


  showSummary();
}


// ==================================================
// まとめ
// ==================================================

function showSummary() {

  const historyHtml =
    state.history
      .map(
        (item, index) => `

          <div class="historyItem">

            <strong>
              対話 ${index + 1}
            </strong>

            <br><br>

            <strong>AI</strong><br>
            ${escapeHtml(item.ai)}

            <br><br>

            <strong>回答</strong><br>
            ${escapeHtml(item.student)}

          </div>
        `
      )
      .join("");


  $("summary").innerHTML = `

    <div class="summaryBlock">

      <strong>生徒番号</strong><br>

      ${escapeHtml(
        state.studentId
      )}

    </div>


    <div class="summaryBlock">

      <strong>氏名</strong><br>

      ${escapeHtml(
        state.studentName
      )}

    </div>


    <div class="summaryBlock">

      <strong>探究テーマ</strong><br>

      ${escapeHtml(
        state.theme
      )}

    </div>


    <div class="summaryBlock">

      <strong>探究段階</strong><br>

      ${escapeHtml(
        state.stage
      )}

    </div>


    <div class="summaryBlock">

      <strong>今回の対話回数</strong><br>

      ${state.history.length}

    </div>


    <h3>壁打ち履歴</h3>

    ${historyHtml}
  `;
}


// ==================================================
// コピー
// ==================================================

async function copyHistory() {

  const lines = [

    `生徒番号：${state.studentId}`,

    `氏名：${state.studentName}`,

    `探究テーマ：${state.theme}`,

    `探究段階：${state.stage}`,

    "",

    "【壁打ち履歴】"
  ];


  state.history
    .forEach(
      (item, index) => {

        lines.push(
          `対話${index + 1}：${item.ai}`
        );

        lines.push(
          `回答：${item.student}`
        );

        lines.push("");
      }
    );


  try {

    await navigator
      .clipboard
      .writeText(
        lines.join("\n")
      );


    $("copyMessage").textContent =
      "コピーしました。";


  } catch {

    $("copyMessage").textContent =
      "コピーできませんでした。";
  }
}


// ==================================================
// HTMLエスケープ
// ==================================================

function escapeHtml(text) {

  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function showMindmap() {

  $("summaryScreen")
    .classList.add("hidden");

  $("mindmapScreen")
    .classList.remove("hidden");


  const items =
    state.history
      .map(
        (item, index) => `

          <div class="mindmapNode">

            <div class="mindmapNumber">
              対話 ${index + 1}
            </div>

            <div class="mindmapQuestion">
              ${escapeHtml(item.ai)}
            </div>

            <div class="mindmapAnswer">
              <strong>回答</strong><br>
              ${escapeHtml(item.student)}
            </div>

          </div>
        `
      )
      .join("");


  const lastIdeas =
    state.history
      .slice(-3)
      .map(item =>
        `<li>${escapeHtml(item.student)}</li>`
      )
      .join("");


  $("mindmapArea").innerHTML = `

    <div class="mindmapTitleBox">

      <div class="mindmapLabel">
        探究テーマ
      </div>

      <div class="mindmapTheme">
        ${escapeHtml(state.theme)}
      </div>

      <div class="mindmapStage">
        ${escapeHtml(state.stage)}
      </div>

    </div>


    <div class="mindmapCenter">

      <div class="centerBubble">

        ${escapeHtml(state.theme)}

      </div>

    </div>


    <div class="mindmapGrid">

      ${items}

    </div>


    <div class="mindmapSummary">

      <h3>
        今回出てきた考え
      </h3>

      <ul>
        ${lastIdeas}
      </ul>

    </div>
  `;
}
