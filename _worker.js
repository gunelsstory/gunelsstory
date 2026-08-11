
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          worker: "gunelsstory",
          message: "Cloudflare Worker işləyir.",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Yalnız POST sorğusu qəbul edilir.",
        }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    try {
      const body = await request.json();

      if (body.action !== "addPortfolio") {
        return new Response(
          JSON.stringify({
            error: "Naməlum action.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      if (!body.item) {
        return new Response(
          JSON.stringify({
            error: "Portfolio məlumatı göndərilməyib.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      if (!env.GITHUB_TOKEN) {
        return new Response(
          JSON.stringify({
            error: "GITHUB_TOKEN Cloudflare Secret kimi əlavə edilməyib.",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const owner = "gunelsstory";
      const repo = "gunelsstory";
      const branch = "main";
      const filePath = "portfolio.json";

      const githubHeaders = {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      };

      const githubUrl =
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

      let existingItems = [];
      let sha = null;

      const existingResponse = await fetch(
        `${githubUrl}?ref=${branch}`,
        {
          headers: githubHeaders,
        }
      );

      if (existingResponse.ok) {
        const existingData = await existingResponse.json();

        sha = existingData.sha;

        const decoded = decodeURIComponent(
          escape(
            atob(
              existingData.content.replace(/\n/g, "")
            )
          )
        );

        try {
          existingItems = JSON.parse(decoded);

          if (!Array.isArray(existingItems)) {
            existingItems = [];
          }
        } catch {
          existingItems = [];
        }
      } else if (existingResponse.status !== 404) {
        const errorText = await existingResponse.text();

        return new Response(
          JSON.stringify({
            error: `GitHub faylı oxuna bilmədi: ${errorText}`,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      existingItems.push(body.item);

      const newContent = JSON.stringify(
        existingItems,
        null,
        2
      );

      const encodedContent = btoa(
        unescape(
          encodeURIComponent(newContent)
        )
      );

      const updateBody = {
        message: `Add portfolio: ${body.item.title || "Yeni layihə"}`,
        content: encodedContent,
        branch: branch,
      };

      if (sha) {
        updateBody.sha = sha;
      }

      const githubWriteResponse = await fetch(
        githubUrl,
        {
          method: "PUT",
          headers: githubHeaders,
          body: JSON.stringify(updateBody),
        }
      );

      const githubResult =
        await githubWriteResponse.json();

      if (!githubWriteResponse.ok) {
        return new Response(
          JSON.stringify({
            error:
              githubResult.message ||
              "GitHub-a yazmaq mümkün olmadı.",
          }),
          {
            status: githubWriteResponse.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Portfolio GitHub-a uğurla əlavə edildi.",
          commit: githubResult.commit?.sha || null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message || "Naməlum Worker xətası.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  },
};
