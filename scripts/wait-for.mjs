const urls = process.argv.slice(2);
if (!urls.length) throw new Error("Provide at least one URL");
for (const url of urls) {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error(`Server did not become ready: ${url}`);
  console.log(`Ready: ${url}`);
}
