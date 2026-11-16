/** Pinned upstream files. Changing versions requires updating and re-verifying every digest. */
export const PARADEE_ASSETS = [
  { name: 'voice.onnx', size: 8462503, sha256: 'f68ed87562d040693dd0dd34e99c11b35ca24294e2149b840503bd1f25a2199f', url: 'https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3/resolve/b569f5efb789af5ba643a44af348427242ceb784/onnx/paradee_int8.onnx' },
  { name: 'config.json', size: 2103, sha256: '021428dbdf35d2cc1d25f66e012ca2fef0439326eb3d60bea79955e223fdd713', url: 'https://huggingface.co/sahilmahendrakar/Paradee-8M-v1.3/resolve/b569f5efb789af5ba643a44af348427242ceb784/config.json' },
  { name: 'g2p.onnx', size: 919774, sha256: '121609f7860de960e329b882695b46b208232af0b05f8a00918dbd91bc3c5be8', url: 'https://raw.githubusercontent.com/sahilmahendrakar/paradee/2de547e45da92840a636c499eb0782e988be1e47/paradee/data/g2p.onnx' },
  { name: 'g2p.json.gz', size: 1176866, sha256: '021865a4b25641c47f110eec78d8f2bcab30dd8e5ebe6ca363e96624327234a5', url: 'https://raw.githubusercontent.com/sahilmahendrakar/paradee/2de547e45da92840a636c499eb0782e988be1e47/paradee/data/g2p.json.gz' },
] as const;

export const PARADEE_DOWNLOAD_BYTES = PARADEE_ASSETS.reduce((total, asset) => total + asset.size, 0);
