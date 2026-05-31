(function () {
  const params = new URLSearchParams(window.location.search);
  const markdownPath = params.get("md") || "content/ai-agent-income.md";
  const allowedRoot = /^(\.\/)?content\/[a-zA-Z0-9/_-]+\.md$/;
  const article = document.querySelector("[data-markdown-article]");
  const titleSlot = document.querySelector("[data-report-title]");
  const metaSlot = document.querySelector("[data-report-meta]");
  const tocSlot = document.querySelector("[data-report-toc]");

  if (!article) return;

  if (!allowedRoot.test(markdownPath)) {
    renderError("Markdown 路径无效。请使用 content/xxx.md 这样的相对路径。");
    return;
  }

  fetch(markdownPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error("无法加载 Markdown 文件");
      }
      return response.text();
    })
    .then((markdown) => {
      const html = renderMarkdown(markdown);
      article.innerHTML = html;
      enhanceDocument();
    })
    .catch(() => {
      renderError("没有找到这篇 Markdown 报告。请检查卡片上的 md 参数是否正确。");
    });

  function renderError(message) {
    article.innerHTML = `<p class="notice">${escapeHtml(message)}</p>`;
    if (titleSlot) titleSlot.textContent = "报告加载失败";
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        i += 1;
        continue;
      }

      if (/^```/.test(line)) {
        const code = [];
        i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1;
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }

      if (/^#{1,6}\s+/.test(line)) {
        const level = line.match(/^#{1,6}/)[0].length;
        const text = line.replace(/^#{1,6}\s+/, "").trim();
        const id = slugify(text);
        blocks.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ""));
          i += 1;
        }
        blocks.push(`<blockquote>${quote.map(renderInline).join("<br>")}</blockquote>`);
        continue;
      }

      if (isTableStart(lines, i)) {
        const tableLines = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          tableLines.push(lines[i]);
          i += 1;
        }
        blocks.push(renderTable(tableLines));
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
          i += 1;
        }
        blocks.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
          i += 1;
        }
        blocks.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
        continue;
      }

      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,6}\s+/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^\s*[-*]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !isTableStart(lines, i)
      ) {
        paragraph.push(lines[i]);
        i += 1;
      }
      blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return blocks.join("\n");
  }

  function enhanceDocument() {
    const h1 = article.querySelector("h1");
    const headings = Array.from(article.querySelectorAll("h2, h3"));

    if (h1 && titleSlot) {
      titleSlot.textContent = h1.textContent;
      document.title = `${h1.textContent} | AI 收入研究站`;
      h1.remove();
    }

    if (metaSlot) {
      metaSlot.innerHTML = `
        <span class="tag">Markdown 报告</span>
        <span class="status ready">已加载</span>
        <span class="status">数据待核验</span>
      `;
    }

    if (tocSlot) {
      if (headings.length) {
        tocSlot.innerHTML = headings
          .map((heading) => `<li><a href="#${heading.id}">${heading.textContent}</a></li>`)
          .join("");
      } else {
        tocSlot.innerHTML = "<li>暂无目录</li>";
      }
    }
  }

  function isTableStart(lines, index) {
    return (
      index + 1 < lines.length &&
      /^\s*\|.*\|\s*$/.test(lines[index]) &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
    );
  }

  function renderTable(tableLines) {
    const rows = tableLines
      .filter((_, index) => index !== 1)
      .map((row) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim())
      );

    const header = rows.shift() || [];
    const body = rows;

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${body
              .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderInline(text) {
    let value = escapeHtml(text);
    value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
    value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    value = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    return value;
  }

  function slugify(text) {
    const ascii = text
      .toLowerCase()
      .replace(/[`~!@#$%^&*()+=[\]{};:'",.<>/?\\|]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (ascii) return encodeURIComponent(ascii);
    return `section-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
