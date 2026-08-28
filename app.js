// ==================================================
// GAS Webアプリ URL
// ==================================================

// ★ここだけ、現在使っている正しいGASの /exec URL にしてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbxkHdYOtBLbpMPDCgDqtBdiltcYvNAhcnVIN3sRFd_SvElx9ZuGXIqPlgD9Uw_6MZN1/exec";

// ==================================================
// 状態
// ==================================================

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


// ==================================================
// DOM取得
// ==================================================

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

    console.error(
      "GASから返ってきた内容:",
      text
    );

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


// ------------------------------
// マインドマップ
// ------------------------------

$("mindmapBtn")
  .addEventListener(
    "click",
    createMindmap
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
// Enterキー
// ==================================================

$("answer")
  .addEventListener(
    "keydown",
    event => {

      // Shift + Enter は改行
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        submitAnswer();
      }
    }
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


  // ------------------------------
  // 入力確認
  // ------------------------------

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

    // ------------------------------
    // 設定取得
    // ------------------------------

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


    // ------------------------------
    // 状態初期化
    // ------------------------------

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

    state.currentAIMessage = "";


    // ------------------------------
    // GASへ開始通知
    // ------------------------------

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
        result.message ||
        "開始できませんでした。"
      );
    }


    // ------------------------------
    // 最初のAIメッセージ
    // ------------------------------

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


    $("startMessage").textContent =
      "";

    $("chatMessage").textContent =
      "";


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


  // ------------------------------
  // 生徒回答表示
  // ------------------------------

  addStudentMessage(
    message
  );


  // ------------------------------
  // 対話回数
  // ------------------------------

  state.turn++;


  // ------------------------------
  // ローカル履歴へ保存
  // ------------------------------

  state.history.push({

    ai:
      state.currentAIMessage,

    student:
      message
  });


  $("answer").value = "";


  try {

    // ------------------------------
    // Geminiへ送信
    // ------------------------------

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
        result.message ||
        "AIとの通信に失敗しました。"
      );
    }


    // ------------------------------
    // 最大回数到達
    // ------------------------------

    if (
      state.turn >= state.maxTurns
    ) {

      await finishSession();

      return;
    }


    // ------------------------------
    // 次のAI質問
    // ------------------------------

    state.currentAIMessage =
      result.message;


    addAIMessage(
      result.message
    );


    updateProgress();


    // ------------------------------
    // 基本回数終了
    // ------------------------------

    if (
      state.turn >= state.basicTurns
    ) {

      $("chatMessage").textContent =
        `${state.basicTurns}回の壁打ちが終わりました。ここで終了しても、もう少し続けてもかまいません。`;

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
    <div class="sender">
      AI
    </div>

    <div class="aiMessage">
    </div>
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
    <div class="sender">
      あなた
    </div>

    <div class="studentMessage">
    </div>
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

            <strong>
              AI
            </strong>
            <br>

            ${escapeHtml(item.ai)}

            <br><br>

            <strong>
              回答
            </strong>
            <br>

            ${escapeHtml(item.student)}

          </div>
        `
      )
      .join("");


  $("summary").innerHTML = `

    <div class="summaryBlock">

      <strong>
        生徒番号
      </strong>
      <br>

      ${escapeHtml(
        state.studentId
      )}

    </div>


    <div class="summaryBlock">

      <strong>
        氏名
      </strong>
      <br>

      ${escapeHtml(
        state.studentName
      )}

    </div>


    <div class="summaryBlock">

      <strong>
        探究テーマ
      </strong>
      <br>

      ${escapeHtml(
        state.theme
      )}

    </div>


    <div class="summaryBlock">

      <strong>
        探究段階
      </strong>
      <br>

      ${escapeHtml(
        state.stage
      )}

    </div>


    <div class="summaryBlock">

      <strong>
        今回の対話回数
      </strong>
      <br>

      ${state.history.length}

    </div>


    <h3>
      壁打ち履歴
    </h3>

    ${historyHtml}
  `;
}


// ==================================================
// 履歴コピー
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


// ==================================================
// マインドマップ作成
// ==================================================

async function createMindmap() {

  $("summaryScreen")
    .classList.add("hidden");

  $("mindmapScreen")
    .classList.remove("hidden");


  $("mindmapLoading")
    .classList.remove("hidden");

  $("mindmapArea")
    .innerHTML =
      "";


  try {

    const result =
      await postRequest({

        action:
          "mindmap",

        theme:
          state.theme,

        stage:
          state.stage,

        history:
          state.history
      });


    if (!result.success) {

      throw new Error(
        result.message ||
        result.error ||
        "マインドマップを作成できませんでした。"
      );
    }


    if (!result.mindmap) {

      throw new Error(
        "マインドマップのデータがありません。"
      );
    }


    drawMindmap(
      result.mindmap
    );


  } catch (error) {

    console.error(error);


    $("mindmapArea")
      .innerHTML = `

        <div class="errorMessage">

          マインドマップを作成できませんでした。

          <br><br>

          ${escapeHtml(
            error.message
          )}

        </div>
      `;


  } finally {

    $("mindmapLoading")
      .classList.add("hidden");
  }
}


// ==================================================
// マインドマップ描画
// ==================================================

function drawMindmap(data) {

  const branches =
    Array.isArray(data.branches)
      ? data.branches
      : [];


  const branchHtml =
    branches
      .map(
        (branch, index) => {

          const items =
            Array.isArray(branch.items)
              ? branch.items
              : [];


          const itemsHtml =
            items
              .map(
                item => `

                  <div class="mindmapItem">

                    ${escapeHtml(item)}

                  </div>
                `
              )
              .join("");


          return `

            <div
              class="mindmapBranch branch${(index % 6) + 1}"
            >

              <div class="branchLine">
              </div>


              <div class="branchBox">

                <div class="branchTitle">

                  ${escapeHtml(
                    branch.title
                  )}

                </div>


                <div class="branchItems">

                  ${itemsHtml}

                </div>

              </div>

            </div>
          `;
        }
      )
      .join("");


  $("mindmapArea")
    .innerHTML = `

      <div class="mindmapStudentInfo">

        <span>
          生徒番号：
          ${escapeHtml(
            state.studentId
          )}
        </span>

        <span>
          氏名：
          ${escapeHtml(
            state.studentName
          )}
        </span>

        <span>
          探究段階：
          ${escapeHtml(
            state.stage
          )}
        </span>

      </div>


      <div class="mindmapCanvas">


        <div class="mindmapCenter">

          <div class="centerLabel">
            探究テーマ
          </div>

          <div class="centerTheme">

            ${escapeHtml(
              data.center ||
              state.theme
            )}

          </div>

        </div>


        <div class="mindmapBranches">

          ${branchHtml}

        </div>


      </div>


      ${
        data.coreIdea

          ? `

            <div class="coreIdea">

              <div class="coreIdeaLabel">

                今回の壁打ちで
                見えてきたこと

              </div>


              <div class="coreIdeaText">

                ${escapeHtml(
                  data.coreIdea
                )}

              </div>

            </div>
          `

          : ""
      }
    `;
}
