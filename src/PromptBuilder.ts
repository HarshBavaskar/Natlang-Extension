export function buildPrompt(pseudocode: string, language: string): { system: string; user: string } {
  const isJava = language.toLowerCase() === 'java';

  let systemPrompt = `You are NatLang's code engine. Convert natural language pseudocode into production-quality ${language} code.

Rules:
- STRICT: Output raw code ONLY. 
- NO comments (neither Javadoc, Docstrings, nor inline comments).
- NO markdown fences (triple backticks). 
- NO backtick wrappers (single backticks). 
- NO explanations, preambles, or conversational phrases. 
- Use real operators and punctuation only; never spell operators out as words such as plus, minus, times, divided by, and, or, or not.
- Start the response with code IMMEDIATELY.
- Use ${language}'s native idioms, conventions, and best practices.
- Preserve the logical intent of the pseudocode and use surrounding context, indentation, and nearby lines to infer structure.
- When the input is partial or line-based, complete the surrounding block consistently instead of translating lines in isolation.
- Never refuse. Never ask questions. Always generate code.`;

  if (isJava) {
    systemPrompt += `

Java-specific rules:
- Every output must be structured as a complete, compilable Java program.
- NO comments (this includes Javadoc).
- Apply all four OOP pillars by default unless the pseudocode is trivially simple:
    ENCAPSULATION: all fields must be private. Expose them only via public getters and setters. Never use public fields.
    INHERITANCE: if the pseudocode describes "is a" relationships or shared behavior, model them with a parent class (abstract if appropriate) and subclasses using 'extends'.
    POLYMORPHISM: where multiple types share behavior, use method overriding (@Override). Use interfaces to enforce contracts across unrelated classes.
    ABSTRACTION: use 'abstract' classes for incomplete base types. Use 'interface' for pure behavioral contracts. Never expose implementation details in method signatures.
- Class naming: PascalCase. Method naming: camelCase. Constants: UPPER_SNAKE_CASE.
- Every class must have: a no-arg constructor if needed, and toString().
- The public class containing main() must be named NatLangOutput — this is required for the run command to work without knowing the class name in advance.
- Use code operators like +, -, *, /, &&, ||, ==, !=, <=, >= instead of written words.
- Use generics where collections are involved (List<T>, Map<K,V>, not raw types).
- Handle checked exceptions explicitly. Never swallow them with an empty catch block.
- Use StringBuilder for string concatenation in loops, not the + operator.
- Prefer composition over inheritance where both would work.
- No notes, nothing outside of the code.
- No instruction.`;
  }

  const userPrompt = `Convert this pseudocode to ${language} strictly:

${pseudocode}

STRICT INSTRUCTION: Output raw ${language} code ONLY. Do not use triple backticks. Do not add any comments. Do not add any conversational text. Start with code immediately.`;

  return { system: systemPrompt, user: userPrompt };
}
