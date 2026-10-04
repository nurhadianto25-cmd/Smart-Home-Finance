import asyncio, os, base64, sys
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")
API_KEY = os.getenv("EMERGENT_LLM_KEY")
OUT = "/app/frontend/assets/images/savings"
os.makedirs(OUT, exist_ok=True)

STYLE = ("3D rendered glossy claymorphism illustration, smooth rounded shapes, soft studio lighting, "
         "vibrant saturated colors with purple and gold accents, premium fintech mobile app asset, "
         "high detail octane render, centered composition, isolated on a fully transparent background, "
         "no text, no words, no letters, no backdrop, no ground shadow")

ITEMS = {
    "hero": "a beautiful glass savings jar filled with shiny gold coins and glowing purple gem crystals overflowing, a round dartboard target with a golden dart in the bullseye on the right, and a small green potted plant sprout, arranged together on a glowing translucent purple glass podium",
    "shield": "a single glossy emerald green protective shield emblem with a small stack of gold coins in front of it, emergency fund protection symbol",
    "vacation": "a brown leather travel suitcase with a small green palm tree and a colorful striped beach ball next to it, tropical family vacation theme",
    "education": "a dark blue graduation mortarboard cap with a gold tassel resting on top of a neat stack of colorful books",
    "car": "a cute rounded glossy red family car seen from a three-quarter front angle",
    "house": "a cozy little house with a blue pitched roof, warm glowing windows and a small chimney, home renovation theme",
    "piggy": "a glossy violet purple piggy bank with a single gold coin dropping into the slot on its back",
    "target": "a round red and white dartboard target with a single golden dart stuck in the center bullseye",
    "avatar": "a friendly 3D cartoon portrait avatar of a smiling Indonesian man in his 30s with short neat black hair, light beard stubble, wearing a smart-casual dark navy shirt, Pixar animation style, head and shoulders, circular framing",
}

async def gen(name, desc):
    chat = LlmChat(api_key=API_KEY, session_id=f"shf-asset-{name}", system_message="You generate clean isolated 3D app icon assets.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    prompt = f"{desc}. {STYLE}."
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if images:
        with open(f"{OUT}/{name}.png", "wb") as f:
            f.write(base64.b64decode(images[0]["data"]))
        print(f"OK {name}")
    else:
        print(f"FAIL {name}")

async def main(names):
    for n in names:
        try:
            await gen(n, ITEMS[n])
        except Exception as e:
            print(f"ERR {n}: {e}")

if __name__ == "__main__":
    names = sys.argv[1:] or list(ITEMS.keys())
    asyncio.run(main(names))
