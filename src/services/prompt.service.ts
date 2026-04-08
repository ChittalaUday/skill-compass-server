export interface UserContext {
    name: string;
    age: number;
    group: string;
    skills: string[];
    interests: string[];
    course?: string;
    branch?: string;
    currentRole?: string;
    targetRole?: string;
    industry?: string;
    experience?: number;
    learningStyle?: string;
    weeklyHours: number;
    accessibility?: any;
}

export interface PathConstraints {
    targetModuleCount: number;
    focusAreas?: string[];
    difficulty: "beginner" | "intermediate" | "advanced" | "expert";
}

export class PromptService {
    /**
     * Generate a unified, token-efficient prompt for learning path generation
     */
    generateLearningPathPrompt(userContext: UserContext, constraints: PathConstraints): string {
        const inputData = {
            user: {
                grp: userContext.group,
                age: userContext.age,
                skills: userContext.skills,
                interests: userContext.interests,
                course: userContext.course,
                branch: userContext.branch,
                role: userContext.currentRole,
                target: userContext.targetRole,
                exp: userContext.experience,
                style: userContext.learningStyle
            },
            config: {
                count: constraints.targetModuleCount,
                diff: constraints.difficulty,
                hours: userContext.weeklyHours
            }
        };

        return `Generate a JSON learning path.
Input: ${JSON.stringify(inputData)}

Strict JSON Output Format:
{
  "name": "Path Name",
  "description": "Short description",
  "modules": [
    {
      "title": "Module Title",
      "description": "Module description",
      "moduleType": "course|micro-lesson|project|assessment|certification|workshop|reading",
      "difficulty": "beginner|intermediate|advanced|expert",
      "duration": 60,
      "skillTags": ["skill1"],
      "category": "Main Category",
      "subcategory": "Sub Category",
      "searchKeywords": "keywords for video search",
      "prerequisites": []
    }
  ],
  "metadata": {}
}

Requirements:
1. Generate exactly ${constraints.targetModuleCount} modules.
2. Sequence modules from foundational to advanced.
3. Align with user group and interests.
4. Return ONLY valid JSON.`;
    }
}

export const promptService = new PromptService();
