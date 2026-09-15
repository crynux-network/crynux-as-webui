export const navLinks = [
  { label: 'Crynux', href: 'https://crynux.io' },
  { label: 'Docs', href: 'https://docs.crynux.io' },
  { label: 'Portal', href: 'https://portal.crynux.io' },
]

export const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/crynux-network' },
  { label: 'Discord', href: 'https://discord.gg/Ug2AHUbrrm' },
  { label: 'X', href: 'https://x.com/crynuxio' },
]

export const serviceTabs = [
  {
    id: 'llm',
    label: 'LLM',
    title: 'OpenAI-Compliant LLM API',
    points: [
      {
        title: 'Seamless Integration',
        body: 'Integrate powerful LLMs with minimal effort using the familiar OpenAI library.',
      },
      {
        title: 'Extensive Model Support',
        body: 'Access all state-of-the-art LLM models from Huggingface.',
      },
      {
        title: 'Async Multi-Task Processing',
        body: 'Run long-running and high-concurrency workloads asynchronously with the OpenAI Responses API.',
      },
    ],
    language: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="https://bridge.crynux-as.xyz/v1/llm",
    # For public demonstration only
    api_key="q3hXHA_8O0LuGJ1_tou4_KamMlQqAo-aYwyAIDttdmI=",
    timeout=180,
    max_retries=1,
)

res = client.chat.completions.create(
    model="Qwen/Qwen2.5-7B",
    messages=[
        {
            "role": "user",
            "content": "What is the capital of France?",
        },
    ],
    stream=False
)

print(res)`,
  },
  {
    id: 'image',
    label: 'Image',
    title: 'Image Generation',
    points: [
      {
        title: 'Broad Model Compatibility',
        body: 'Utilize a vast ecosystem of open-source diffusion models. The service is compatible with popular community-driven checkpoints and a wide range of custom models.',
      },
      {
        title: 'Modular Control Architecture',
        body: 'Achieve precise creative control with a flexible, modular architecture. The service supports components for fine-grained style adaptation (e.g., LoRA), variational autoencoders (VAEs), and structural conditioning (e.g., ControlNet).',
      },
      {
        title: 'Massive Parallel Processing',
        body: 'Execute thousands of generation tasks concurrently. The Crynux network is built for high-throughput, parallel processing, delivering massive scale at a fraction of the traditional cost.',
      },
    ],
    language: 'json',
    code: `{
    "version": "2.0.0",
    "base_model": {
        "name": "stabilityai/sdxl-turbo"
    },
    "prompt": "stillsuit mask up, gloves, solo, highly detailed eyes...",
    "negative_prompt": "...",
    "task_config": {
        "num_images": 9,
        "steps": 1,
        "cfg": 0
    },
    "lora": {
        "model": "https://civitai.com/api/download/models/178048"
    },
    "controlnet": {
        "model": "diffusers/controlnet-canny-sdxl-1.0",
        "image_dataurl": "data:image/png;base64,12FE1373...",
        "preprocess": {
            "method": "canny"
        },
        "weight": 70
    }
}`,
  },
  {
    id: 'training',
    label: 'Training',
    title: 'Image Model Customization',
    points: [
      {
        title: 'LoRA Fine-Tuning',
        body: 'Efficiently create specialized models using Low-Rank Adaptation (LoRA). Fine-tune any compatible base model on the network with your own dataset to achieve unique styles and subjects.',
      },
      {
        title: 'Distributed Training Network',
        body: 'Leverage a global network of distributed GPUs for your training tasks. Our platform makes model customization accessible and scalable, without the need for dedicated high-end hardware.',
      },
      {
        title: 'Full Model Ownership',
        body: 'You retain complete ownership and control over your trained LoRA models. Download and deploy them anywhere, without restrictions.',
      },
    ],
    language: 'json',
    code: `{
    "model": {
        "name": "runwayml/stable-diffusion-v1-5",
        "revision": "main"
    },
    "dataset": {
        "name": "lambdalabs/naruto-blip-captions",
        "image_column": "image",
        "caption_column": "text"
    },
    "validation": {
        "num_images": 4
    },
    "train_args": {
        "learning_rate": "1e-4",
        "batch_size": 1,
        "gradient_accumulation_steps": 4,
        "num_train_steps": 100,
        "max_train_steps": 15000
    },
    "lora": {
        "rank": 4,
        "init_lora_weights": "gaussian",
        "target_modules": ["to_k", "to_q", "to_v", "to_out.0"]
    },
    "transforms": {
        "center_crop": true,
        "random_flip": true
    },
    "dataloader_num_workers": 2,
    "mixed_precision": "fp16",
    "seed": 1337,
    "checkpoint": null,
    "version": "2.1.0"
}`,
  },
  {
    id: 'video',
    label: 'Video',
    title: 'Video Generation is on the way',
    points: [
      {
        title: '',
        body: 'Our team is hard at work building a powerful, decentralized video generation service. Please check back for future updates!',
      },
    ],
    language: null,
    code: null,
  },
]

export const integrations = [
  {
    name: 'Langchain',
    href: 'https://www.langchain.com',
    gray: '/home/tools/langchain-gray.png',
    color: '/home/tools/langchain.png',
  },
  {
    name: 'ComfyUI',
    href: 'https://www.comfy.org',
    gray: '/home/tools/comfyui-gray.png',
    color: '/home/tools/comfyui.png',
  },
  {
    name: 'CamelAI',
    href: 'https://www.camel-ai.org',
    gray: '/home/tools/camel-ai-gray.png',
    color: '/home/tools/camel-ai.png',
  },
  {
    name: 'Hermes Agent',
    href: 'https://hermes-agent.nousresearch.com',
    gray: '/home/tools/hermes-agent.svg',
    color: '/home/tools/hermes-agent.svg',
  },
]

export const highlights = [
  {
    title: 'Unmatched Scalability',
    items: [
      'Harness the power of a decentralized network with thousands of GPUs at your disposal.',
      'A single API call executes task across thousands of GPUs, eliminating all infrastructure overhead.',
      'Process massive batch tasks with exceptional speed, powered by parallel processing.',
    ],
  },
  {
    title: 'Rock-Solid Reliability',
    items: [
      'Our advanced QoS-based scheduling guarantees optimal task routing and swift response times.',
      'Achieve up to 99.99% task success rate through redundant and concurrent processing.',
    ],
  },
  {
    title: 'Extreme Cost-Effectiveness',
    items: [
      'Benefit from our use of distributed computing resources to enjoy significantly lower costs.',
      'Charges follow actual input and output token usage, so you pay only for what you use.',
    ],
  },
]

export const useCases = [
  {
    title: 'Game & Metaverse World-Building',
    items: [
      'Instantly generate rich lore and dynamic dialogues.',
      'Create endless unique in-game assets and textures.',
      'Build entire universes at an unprecedented scale.',
    ],
  },
  {
    title: 'Asset Production for Film & Animation',
    items: [
      'Bring characters and storyboards to life from text.',
      'Explore infinite stylistic variations for concept art.',
      'Empower creatives with a limitless asset library.',
    ],
  },
  {
    title: 'Large-Scale Data Analysis',
    items: [
      'Uncover hidden insights from massive datasets.',
      'Transform raw data into strategic intelligence.',
      'Analyze sentiment and trends at unparalleled scale.',
    ],
  },
  {
    title: 'Synthetic Data Generation',
    items: [
      'Create millions of diverse text and image samples.',
      'Craft the perfect dataset to overcome data scarcity.',
      'Fuel the next generation of smarter, unbiased AI.',
    ],
  },
  {
    title: 'And Many More...',
    items: [
      'The possibilities are endless.',
      'Unleash your creativity and bring your wildest ideas to life.',
    ],
  },
]
