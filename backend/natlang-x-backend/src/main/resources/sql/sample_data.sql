USE natlangx;

INSERT INTO users(name, email, password, role)
VALUES
('Admin User', 'admin@natlangx.dev', 'admin123', 'ADMIN'),
('Standard User', 'user@natlangx.dev', 'user123', 'USER');

INSERT INTO transpilations(
    user_id, prompt, generated_code, optimized_code, explanation, time_complexity,
    space_complexity, suggestions, topic, provider, language, agent_steps, decision_log
)
VALUES
(
    1,
    'optimize this factorial logic',
    'public class NatLangOutput { public static void main(String[] args) { int n = 5; int res = 1; for(int i=1;i<=n;i++){res*=i;} System.out.println(res);} }',
    'public class NatLangOutput { public static long factorial(int n){ if(n < 0){ throw new IllegalArgumentException("n must be >= 0"); } long result = 1L; for(int i=2;i<=n;i++){ result *= i; } return result; } public static void main(String[] args){ System.out.println(factorial(5)); } }',
    'The optimized version extracts factorial into a reusable method and validates input.',
    'O(n)',
    'O(1)',
    'Use long for safer multiplication range and method extraction for reuse.',
    'Data Structures',
    'openai',
    'Java',
    'Generated,Analyzed,Optimized,Explained',
    'Agent chose optimize-first pipeline'
);
